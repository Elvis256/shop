import "./lib/validateEnv";
import logger from "./lib/logger";
import prisma from "./lib/prisma";
import redis from "./lib/redis";
import { scheduleRepeatingJobs, closeQueues, createWorker, notificationQueue } from "./lib/queue";
import type { Worker } from "bullmq";

/**
 * Dedicated worker process for background jobs.
 * Runs separately from the HTTP server so jobs don't block request handling.
 * Uses BullMQ for reliable job scheduling with Redis-backed persistence.
 */

process.on("unhandledRejection", (reason) => {
  logger.error("worker_unhandled_rejection", { error: String(reason) });
});
process.on("uncaughtException", (err) => {
  logger.error("worker_uncaught_exception", { error: err.message, stack: err.stack });
  setTimeout(() => process.exit(1), 1000);
});

const intervalHandles: NodeJS.Timeout[] = [];
const bullWorkers: Worker[] = [];

async function startWorker() {
  logger.info("worker_starting", { pid: process.pid });

  // ── Schedule BullMQ repeating jobs ─────────────────────
  try {
    await scheduleRepeatingJobs();
    logger.info("bullmq_jobs_scheduled");
  } catch (err: any) {
    logger.warn("bullmq_schedule_failed", { error: err.message, fallback: "using setInterval" });
  }

  // ── Notification worker ─────────────────────────────────
  try {
    const { dispatch } = await import("./services/notificationDispatcher");
    bullWorkers.push(
      createWorker("notifications", async (job) => {
        await dispatch(job.data);
      })
    );
    logger.info("notification_worker_started");
  } catch (err: any) {
    logger.error("notification_worker_start_failed", { error: err.message });
  }

  // ── Imported background jobs (setInterval-based — kept as fallback) ────
  const startJob = (name: string, importFn: Promise<any>, startFn: string) => {
    importFn
      .then((mod) => { mod[startFn](); logger.info("worker_job_started", { job: name }); })
      .catch((err) => logger.error("worker_job_start_failed", { job: name, error: err.message }));
  };

  startJob("stock_reservation_cleanup", import("./utils/stockReservation"), "startReservationCleanup");
  startJob("abandoned_cart_emails", import("./services/abandonedCart"), "startAbandonedCartJob");
  startJob("exchange_rate_refresh", import("./services/exchangeRates"), "startRateRefreshJob");
  startJob("aliexpress_tracking_sync", import("./services/aliexpressSync"), "startTrackingSyncJob");
  startJob("aliexpress_price_sync", import("./services/aliexpressSync"), "startPriceSyncJob");
  startJob("cj_tracking_sync", import("./services/cjSync"), "startCJTrackingSyncJob");
  startJob("cj_price_sync", import("./services/cjSync"), "startCJPriceSyncJob");
  startJob("review_requests", import("./services/reviewRequests"), "startReviewRequestJob");
  startJob("restock_reminders", import("./services/restockReminder"), "startRestockReminderJob");
  startJob("subscription_boxes", import("./services/subscriptionBoxes"), "startSubscriptionBoxJob");
  startJob("smart_reorder", import("./services/smartReorder"), "startSmartReorderJob");
  startJob("seller_tiers", import("./scripts/evaluateSellerTiers"), "startSellerTierJob");
  startJob("ad_billing", import("./services/adBilling"), "startAdBillingJob");
  startJob("installment_reminders", import("./services/installmentReminders"), "startInstallmentReminderJob");
  startJob("layaway_reminders", import("./services/layawayReminders"), "startLayawayReminderJob");

  // ── Dispute SLA auto-escalation — every hour ────────────
  intervalHandles.push(setInterval(async () => {
    try {
      const now = new Date();

      // Auto-escalate disputes where seller deadline has passed without response
      const overdue = await prisma.dispute.findMany({
        where: {
          status: { in: ["OPEN", "SELLER_RESPONSE"] },
          sellerDeadline: { lt: now },
          escalatedAt: null,
        },
        select: { id: true, disputeNumber: true, priority: true },
      });

      for (const dispute of overdue) {
        await prisma.dispute.update({
          where: { id: dispute.id },
          data: {
            status: "UNDER_REVIEW",
            escalatedAt: now,
            priority: dispute.priority === "LOW" ? "MEDIUM" : dispute.priority === "MEDIUM" ? "HIGH" : "URGENT",
          },
        });
      }

      // Set seller deadline on new disputes that don't have one (48h for normal, 24h for HIGH/URGENT)
      const noDeadline = await prisma.dispute.findMany({
        where: { status: "OPEN", sellerDeadline: null },
        select: { id: true, priority: true },
      });
      for (const dispute of noDeadline) {
        const hours = ["HIGH", "URGENT"].includes(dispute.priority) ? 24 : 48;
        await prisma.dispute.update({
          where: { id: dispute.id },
          data: { sellerDeadline: new Date(Date.now() + hours * 60 * 60 * 1000) },
        });
      }

      if (overdue.length > 0) {
        logger.info("dispute_sla_escalated", { count: overdue.length });
      }
    } catch (err: any) {
      logger.error("dispute_sla_check_failed", { error: err.message });
    }
  }, 60 * 60 * 1000));

  // ── Webhook retry processing — every 5 minutes ─────────
  intervalHandles.push(setInterval(async () => {
    try {
      const retries = await prisma.webhookRetry.findMany({
        where: {
          resolved: false,
          nextRetryAt: { lte: new Date() },
        },
        take: 20,
        orderBy: { nextRetryAt: "asc" },
      });

      for (const retry of retries) {
        if (retry.attempts >= retry.maxAttempts) {
          await prisma.webhookRetry.update({
            where: { id: retry.id },
            data: { resolved: true, resolvedAt: new Date(), lastError: "Max attempts reached" },
          });
          continue;
        }

        try {
          // Re-process the webhook payload
          const payload = retry.payload as any;
          if (retry.provider === "flutterwave" && payload?.data?.tx_ref) {
            // Verify with provider and process
            const { verifyFlutterwaveTransaction } = await import("./services/flutterwave");
            const verification = await verifyFlutterwaveTransaction(payload.data.id || payload.data.tx_ref);
            if (verification?.status === "successful") {
              // Mark as resolved — the webhook handler in the main app processes this
              await prisma.webhookRetry.update({
                where: { id: retry.id },
                data: { resolved: true, resolvedAt: new Date() },
              });
              continue;
            }
          }

          // Exponential backoff: 5min, 15min, 45min, 2h, 6h
          const backoffMinutes = Math.pow(3, retry.attempts) * 5;
          await prisma.webhookRetry.update({
            where: { id: retry.id },
            data: {
              attempts: { increment: 1 },
              nextRetryAt: new Date(Date.now() + backoffMinutes * 60 * 1000),
              lastError: "Retry scheduled",
            },
          });
        } catch (err: any) {
          await prisma.webhookRetry.update({
            where: { id: retry.id },
            data: {
              attempts: { increment: 1 },
              nextRetryAt: new Date(Date.now() + 30 * 60 * 1000),
              lastError: err.message?.slice(0, 500),
            },
          });
        }
      }
    } catch (err: any) {
      logger.error("webhook_retry_failed", { error: err.message });
    }
  }, 5 * 60 * 1000));

  // ── Delayed dispatch release — every 5 minutes ──────────
  intervalHandles.push(setInterval(async () => {
    try {
      const now = new Date();
      // Find confirmed orders with past/due dispatchScheduledAt
      const pendingDelayedOrders = await prisma.order.findMany({
        where: {
          status: "CONFIRMED",
          dispatchScheduledAt: {
            not: null,
            lte: now,
          },
        },
        select: { id: true, orderNumber: true },
      });

      if (pendingDelayedOrders.length > 0) {
        logger.info("delayed_dispatch_release_triggered", { count: pendingDelayedOrders.length });
        const { placeAliExpressOrdersForOrder } = await import("./services/aliexpressOrder");
        const { placeCJOrdersForOrder } = await import("./services/cjOrder");

        for (const order of pendingDelayedOrders) {
          logger.info(`Releasing delayed order ${order.orderNumber} (${order.id}) from hold queue`);
          // Set dispatchScheduledAt to null to mark it as processed and prevent duplicate runs
          await prisma.order.update({
            where: { id: order.id },
            data: { dispatchScheduledAt: null },
          });

          await placeAliExpressOrdersForOrder(order.id).catch((err: any) =>
            logger.error(`AliExpress delayed order failed for ${order.id}`, { error: err.message })
          );
          await placeCJOrdersForOrder(order.id).catch((err: any) =>
            logger.error(`CJ delayed order failed for ${order.id}`, { error: err.message })
          );
        }
      }
    } catch (err: any) {
      logger.error("delayed_dispatch_check_failed", { error: err.message });
    }
  }, 5 * 60 * 1000));

  // ── Escrow Auto-Release hold cleanup — every hour ─────────
  intervalHandles.push(setInterval(async () => {
    try {
      const now = new Date();
      // Find all HELD escrows that have passed their release date
      const expiredEscrows = await prisma.escrowTransaction.findMany({
        where: {
          status: "HELD",
          releaseDate: { lte: now },
        },
        include: {
          order: {
            include: {
              payments: { select: { provider: true, method: true } },
              items: { select: { sellerId: true, price: true, quantity: true, commission: true, shippingFeeCharged: true } },
            },
          },
        },
      });

      for (const escrow of expiredEscrows) {
        await prisma.$transaction(async (tx) => {
          await tx.escrowTransaction.update({
            where: { id: escrow.id },
            data: { status: "RELEASED", releasedAt: new Date() },
          });

          // Release seller funds: move pendingBalance → balance for all sellers.
          // Earnings were held in pendingBalance at payment confirmation (or COD collection).
          const sellerAmounts: Record<string, number> = {};
          for (const item of escrow.order.items) {
            if (item.sellerId) {
              const itemTotal = parseFloat(item.price.toString()) * item.quantity;
              const commission = item.commission ? parseFloat(item.commission.toString()) : itemTotal * 0.15;
              const shippingFeeDeduction = item.shippingFeeCharged ? parseFloat(item.shippingFeeCharged.toString()) : 0;
              const sellerAmount = itemTotal - commission - shippingFeeDeduction;
              sellerAmounts[item.sellerId] = (sellerAmounts[item.sellerId] || 0) + sellerAmount;
            }
          }

          for (const [sellerId, amount] of Object.entries(sellerAmounts)) {
            await tx.seller.update({
              where: { id: sellerId },
              data: {
                pendingBalance: { decrement: amount },
                balance: { increment: amount },
              },
            });
          }

          await tx.orderEvent.create({
            data: {
              orderId: escrow.orderId,
              status: "ESCROW_RELEASED",
              note: "Funds auto-released from escrow to seller(s) after holding period expired.",
            },
          });
        });
      }

      if (expiredEscrows.length > 0) {
        logger.info("escrows_auto_released", { count: expiredEscrows.length });
      }
    } catch (err: any) {
      logger.error("escrow_auto_release_job_failed", { error: err.message });
    }
  }, 60 * 60 * 1000));

  // ── Inline periodic jobs ─────────────────────────────────

  // Private order history cleanup — runs daily
  intervalHandles.push(setInterval(async () => {
    try {
      const users = await prisma.user.findMany({
        where: { orderHistoryDays: { not: null } },
        select: { id: true, orderHistoryDays: true },
      });
      for (const user of users) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - user.orderHistoryDays!);
        await prisma.order.updateMany({
          where: { userId: user.id, createdAt: { lt: cutoff }, status: { in: ["DELIVERED", "CANCELLED"] } },
          data: { userId: null },
        });
      }
    } catch (err: any) {
      logger.error("order_history_cleanup_failed", { error: err.message });
    }
  }, 24 * 60 * 60 * 1000));

  // Guest data auto-delete cleanup — runs daily
  intervalHandles.push(setInterval(async () => {
    try {
      const result = await prisma.order.updateMany({
        where: {
          guestDataExpiresAt: { lt: new Date() },
          userId: null,
          status: { in: ["DELIVERED", "CANCELLED"] },
          customerName: { not: "Guest" },
        },
        data: {
          customerName: "Guest",
          customerEmail: "deleted",
          customerPhone: "deleted",
          shippingAddress: "{}",
        },
      });
      if (result.count > 0) {
        logger.info("guest_data_cleanup", { anonymized: result.count });
      }
    } catch (err: any) {
      logger.error("guest_data_cleanup_failed", { error: err.message });
    }
  }, 24 * 60 * 60 * 1000));

  // Expired refresh token cleanup — every 6 hours
  intervalHandles.push(setInterval(async () => {
    try {
      const result = await prisma.refreshToken.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      if (result.count > 0) {
        logger.info("token_cleanup", { deleted: result.count });
      }
    } catch (err: any) {
      logger.error("token_cleanup_failed", { error: err.message });
    }
  }, 6 * 60 * 60 * 1000));

  // Expired coupon cleanup — every 12 hours
  intervalHandles.push(setInterval(async () => {
    try {
      const result = await prisma.coupon.deleteMany({
        where: {
          validUntil: { lt: new Date() },
          usageLimit: 1,
          usedCount: 0,
          code: { startsWith: "COMEBACK-" },
        },
      });
      if (result.count > 0) {
        logger.info("expired_coupon_cleanup", { deleted: result.count });
      }
    } catch (err: any) {
      logger.error("expired_coupon_cleanup_failed", { error: err.message });
    }
  }, 12 * 60 * 60 * 1000));

  // Run token cleanup once on startup after 10s
  setTimeout(async () => {
    try {
      await prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    } catch {}
  }, 10_000);

  logger.info("worker_started", { pid: process.pid });
}

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info("worker_shutdown_initiated", { signal });
  for (const handle of intervalHandles) clearInterval(handle);
  await closeQueues(bullWorkers).catch(() => {});
  await prisma.$disconnect().catch(() => {});
  await redis.quit().catch(() => {});
  logger.info("worker_shutdown_complete");
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

startWorker();
