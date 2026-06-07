import "./lib/validateEnv";
import logger from "./lib/logger";
import prisma from "./lib/prisma";
import redis from "./lib/redis";

/**
 * Dedicated worker process for background jobs.
 * Runs separately from the HTTP server so jobs don't block request handling.
 */

process.on("unhandledRejection", (reason) => {
  logger.error("worker_unhandled_rejection", { error: String(reason) });
});
process.on("uncaughtException", (err) => {
  logger.error("worker_uncaught_exception", { error: err.message, stack: err.stack });
  setTimeout(() => process.exit(1), 1000);
});

const intervalHandles: NodeJS.Timeout[] = [];

async function startWorker() {
  logger.info("worker_starting", { pid: process.pid });

  // ── Imported background jobs ─────────────────────────────
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
  await prisma.$disconnect().catch(() => {});
  await redis.quit().catch(() => {});
  logger.info("worker_shutdown_complete");
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

startWorker();
