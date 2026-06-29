import { Router, Request, Response } from "express";
import { verifyFlutterwaveHash } from "../utils/verifyFlutterwave";
import { verifyFlutterwaveTransaction } from "../services/flutterwave";
import prisma from "../lib/prisma";
import { placeAliExpressOrdersForOrder } from "../services/aliexpressOrder";
import { placeCJOrdersForOrder } from "../services/cjOrder";
import { handleLayawayPayment } from "./layaway";
import { awardPurchasePoints } from "./loyalty";
import { confirmPaidOrder, releaseOrderStock } from "../services/orderConfirmation";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";
const router = Router();

// POST /api/webhooks/flutterwave
router.post("/flutterwave", asyncHandler(async (req: Request, res: Response) => {
  try {
    // Verify webhook signature
    const hash = req.headers["verif-hash"] as string | undefined;
    if (!verifyFlutterwaveHash(hash)) {
      logger.warn("Invalid webhook hash received");
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { event, data } = req.body;

    if (event === "charge.completed" && !data.tx_ref?.startsWith("installment-") && !data.tx_ref?.startsWith("layaway-")) {
      const tx_ref = data.tx_ref;
      const status = data.status;
      const flw_ref = data.flw_ref;
      const amount = data.amount;
      const currency = data.currency;

      const orderId = tx_ref.startsWith("split-init-") || tx_ref.startsWith("split-part-")
        ? tx_ref.split("-").slice(2).join("-")
        : tx_ref;

      // Idempotency: use INSERT with unique constraint first (atomic)
      // This prevents race conditions from concurrent duplicate webhooks
      try {
        await prisma.processedWebhook.create({
          data: {
            webhookId: flw_ref,
            provider: "flutterwave",
            eventType: event,
          },
        });
      } catch (idempotencyError: any) {
        if (idempotencyError.code === "P2002") {
          logger.info(`Webhook ${flw_ref} already processed (unique constraint), skipping`);
          return res.status(200).json({ received: true, duplicate: true });
        }
        throw idempotencyError;
      }

      // Find the order
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { payments: true, items: true },
      });

      if (!order) {
        logger.warn(`Order not found for tx_ref: ${tx_ref} (orderId: ${orderId})`);
        return res.status(200).json({ error: "Order not found", received: true });
      }

      // Server-side verification: confirm transaction with Flutterwave API
      try {
        const verification = await verifyFlutterwaveTransaction(data.id?.toString() || flw_ref);
        const verifiedStatus = verification?.data?.status;
        const verifiedAmount = verification?.data?.amount;
        const verifiedCurrency = verification?.data?.currency;
        if (verifiedStatus !== "successful" && status === "successful") {
          logger.warn(`Flutterwave verification mismatch for ${tx_ref}: webhook says successful, API says ${verifiedStatus}`);
          // Return 4xx so Flutterwave retries the webhook. A genuine transient
          // verification delay will then be processed; persistent mismatches will
          // eventually be flagged below after retries exhaust.
          return res.status(422).json({ error: "Verification mismatch", received: false });
        }
        if (verifiedAmount !== undefined && verifiedAmount !== amount) {
          logger.warn(`Flutterwave verified amount mismatch for ${tx_ref}: webhook ${amount}, API ${verifiedAmount}`);
          return res.status(200).json({ error: "Amount verification mismatch", received: true });
        }
      } catch (verifyErr) {
        logger.error(`Flutterwave server-side verification failed for ${tx_ref}, flagging for manual review`, { error: verifyErr });
        // Do NOT proceed with unverified payment — flag the order for review.
        // Return 503 so Flutterwave retries; if it keeps failing the order is
        // flagged for manual intervention rather than silently accepted.
        await prisma.order.update({
          where: { id: orderId },
          data: { notes: "FLAGGED: Flutterwave server-side verification failed. Manual review required." },
        }).catch(() => {});
        return res.status(503).json({ received: false, flagged: true, error: "Verification service unavailable" });
      }

      // Verify amount AND currency match
      if (currency !== order.currency) {
        logger.warn(`Currency mismatch for order ${tx_ref}: expected ${order.currency}, got ${currency}`);
        return res.status(200).json({ error: "Currency mismatch", received: true });
      }
      // Compare against the payment record amount (handles installments correctly)
      const matchingPayment = order.payments.find(p => p.flwRef === flw_ref || p.flwRef === tx_ref);
      let expectedAmount = matchingPayment ? Number(matchingPayment.amount) : Number(order.totalAmount);
      if (order.isSplitPayment && !matchingPayment) {
        expectedAmount = Math.ceil(Number(order.totalAmount) / 2);
      }
      if (expectedAmount !== amount) {
        logger.warn(`Amount mismatch for order ${tx_ref}: expected ${expectedAmount}, got ${amount}`);
        return res.status(200).json({ error: "Amount mismatch", received: true });
      }

      // Process webhook in a transaction
      await prisma.$transaction(async (tx) => {
        // Get stock reservations for this order
        const reservations = await tx.stockReservation.findMany({
          where: { orderId, released: false },
        });

        if (status === "successful") {
          // Guard: reject if order already has a terminal payment status
          const existingOrder = await tx.order.findUnique({
            where: { id: orderId },
            select: { 
              paymentStatus: true, 
              totalAmount: true, 
              currency: true, 
              isSplitPayment: true, 
              splitPaidAmount: true, 
              splitPartnerPaid: true,
              splitPartnerPhone: true,
              customerName: true
            },
          });
          if (existingOrder?.paymentStatus === "SUCCESSFUL") {
            logger.info(`Order ${orderId} already paid, skipping duplicate confirmation`);
            return;
          }

          await tx.payment.updateMany({
            where: { orderId, flwRef: flw_ref },
            data: {
              status: "SUCCESSFUL",
              flwTxId: flw_ref,
            },
          });

          let isFullyPaid = true;
          const hasPendingCod = order.payments.some(p => p.method === "COD" && p.status === "PENDING");

          if (existingOrder?.isSplitPayment && !existingOrder?.splitPartnerPaid) {
            const currentPaid = Number(existingOrder.splitPaidAmount) + amount;
            isFullyPaid = currentPaid >= Number(existingOrder.totalAmount);
            
            await tx.order.update({
              where: { id: orderId },
              data: {
                splitPaidAmount: currentPaid,
                splitPartnerPaid: isFullyPaid,
                paymentStatus: isFullyPaid ? "SUCCESSFUL" : "PENDING",
                status: isFullyPaid ? "CONFIRMED" : "PENDING",
              },
            });
            
            if (!isFullyPaid) {
              // Extend stock reservation to 24 hours to give partner time to pay
              const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
              await tx.stockReservation.updateMany({
                where: { orderId, released: false },
                data: { expiresAt: newExpiry },
              });
              logger.info(`Split payment part successful for order ${orderId}. Reservation extended for 24h. Waiting for second half.`);

              // Trigger secure partner payment link via SMS/WhatsApp
              if (existingOrder.splitPartnerPhone) {
                const { sendWhatsApp } = await import("../services/whatsapp");
                const { sendSMS } = await import("../services/sms");
                const paymentUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/checkout/split/${orderId}`;
                const initiatorLabel = existingOrder.customerName || "Your partner";
                const shareAmount = Math.ceil(Number(existingOrder.totalAmount) / 2);
                const formattedAmount = `USh ${shareAmount.toLocaleString()}`;
                
                const message = `👥 ${initiatorLabel} has split a payment with you 50/50 for their order!\n\nThey paid their half, and your share is ${formattedAmount}.\n\nComplete your secure payment here to process the order:\n${paymentUrl}`;
                
                sendWhatsApp({ to: existingOrder.splitPartnerPhone, text: message })
                  .then((waSent) => {
                    if (!waSent) sendSMS(existingOrder.splitPartnerPhone!, message).catch(() => {});
                  })
                  .catch(() => {
                    sendSMS(existingOrder.splitPartnerPhone!, message).catch(() => {});
                  });
              }
              return;
            }
          } else if (hasPendingCod) {
            // For COD orders: confirmation of 20% deposit transitions status to CONFIRMED,
            // but paymentStatus remains PENDING until courier confirms the remainder (80%) on delivery.
            await tx.order.update({
              where: { id: orderId },
              data: { status: "CONFIRMED", paymentStatus: "PENDING" },
            });
          } else {
            // Standard fully-paid order: use shared confirmation service.
            await confirmPaidOrder(tx, orderId, { order });
            logger.info(`Order ${orderId} marked as CONFIRMED`);
          }
        } else {
          await tx.payment.updateMany({
            where: { orderId },
            data: { status: "FAILED" },
          });

          await tx.order.update({
            where: { id: orderId },
            data: { status: "CANCELLED", paymentStatus: "FAILED" },
          });

          const { refundStoreCreditForOrder } = await import("../utils/storeCredit");
          await refundStoreCreditForOrder(tx, orderId);

          // Release reserved stock back to available
          await releaseOrderStock(tx, orderId);

          logger.info(`Order ${orderId} payment failed`);
        }
      });

      // After successful payment: place dropshipping orders & award loyalty points
      // Note: Cart is cleared on the frontend upon redirect to success page
      if (status === "successful") {
        if (order.userId) {
          awardPurchasePoints(order.userId, Number(order.totalAmount), order.id)
            .catch(err => logger.error("Failed to award purchase points", { error: err }));
        }

        // Notify recipient if it's a gift order
        if (order.isGift && order.giftToken && order.giftRecipientPhone) {
          const { sendWhatsApp } = await import("../services/whatsapp");
          const { sendSMS } = await import("../services/sms");
          const addressUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/gift/${order.giftToken}`;
          const senderLabel = order.customerName || "Someone special";
          const message = order.giftMessage
            ? `🎁 ${senderLabel} sent you a gift!\n\n"${order.giftMessage}"\n\nChoose where to deliver it (plain packaging, discreet):\n${addressUrl}`
            : `🎁 ${senderLabel} sent you a gift from PleasureZone!\n\nChoose your delivery address (plain packaging):\n${addressUrl}`;
          
          sendWhatsApp({ to: order.giftRecipientPhone, text: message })
            .then((waSent) => {
              if (!waSent) sendSMS(order.giftRecipientPhone!, message).catch(() => {});
            })
            .catch(() => {
              sendSMS(order.giftRecipientPhone!, message).catch(() => {});
            });
        }

        // Delay placement if hold queue / dispatch delay is active
        if (!order.dispatchScheduledAt || new Date(order.dispatchScheduledAt) <= new Date()) {
          placeAliExpressOrdersForOrder(orderId).catch((err) => {
            logger.error(`AliExpress auto-order failed for ${orderId}`, { error: err.message });
          });
          placeCJOrdersForOrder(orderId).catch((err) => {
            logger.error(`CJ auto-order failed for ${orderId}`, { error: err.message });
          });
        } else {
          logger.info(`[Dropship] Delayed dispatch active for order ${orderId} until ${order.dispatchScheduledAt}. Order added to hold queue.`);
        }
      }
    }

    // Handle installment payment webhooks
    if (event === "charge.completed" && data.tx_ref?.startsWith("installment-")) {
      const parts = data.tx_ref.split("-");
      // format: installment-{planId}-{paymentId} (CUIDs, no hyphens in IDs)
      if (parts.length >= 3) {
        const planId = parts[1];
        const paymentId = parts.slice(2).join("-");

        // Idempotency guard for installment webhooks
        try {
          await prisma.processedWebhook.create({
            data: { webhookId: `installment-${data.flw_ref || data.id}`, provider: "flutterwave", eventType: "installment" },
          });
        } catch (err: any) {
          if (err.code === "P2002") {
            logger.info(`Installment webhook ${data.flw_ref || data.id} already processed, skipping`);
            return res.status(200).json({ received: true, duplicate: true });
          }
          throw err;
        }

        try {
          if (data.status === "successful") {
            const plan = await prisma.installmentPlan.findUnique({
              where: { id: planId },
              include: { payments: { orderBy: { number: "asc" } } },
            });
            if (plan) {
              const newPaidCount = plan.paidCount + 1;
              const isCompleted = newPaidCount >= plan.installments;
              const intervalDays = plan.installments <= 2 ? 14 : 30;

              await prisma.$transaction([
                prisma.installmentPayment.update({
                  where: { id: paymentId },
                  data: { status: "PAID", paidAt: new Date() },
                }),
                prisma.installmentPlan.update({
                  where: { id: planId },
                  data: {
                    paidCount: newPaidCount,
                    status: isCompleted ? "COMPLETED" : "ACTIVE",
                    nextDueDate: isCompleted
                      ? plan.nextDueDate
                      : new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000),
                  },
                }),
              ]);
              logger.info(`Installment ${paymentId} paid for plan ${planId}`);
            }
          }
        } catch (err) {
          logger.error("Installment webhook error", { error: err, planId, paymentId });
        }
      }
    }

    // Handle layaway payment webhooks
    if (event === "charge.completed" && data.tx_ref?.startsWith("layaway-")) {
      const parts = data.tx_ref.split("-");
      if (parts.length >= 3) {
        const planId = parts[1];
        const paymentId = parts.slice(2).join("-");
        handleLayawayPayment(planId, paymentId, data.status).catch(err => {
          logger.error("Layaway webhook handler error", { error: err });
        });
      }
    }

    // Handle transfer webhooks (payouts)
    if (event === "transfer.completed" || event === "transfer.failed") {
      const transferData = data;
      const reference = transferData.reference || "";

      // Extract payout ID from reference "payout-{id}"
      if (reference.startsWith("payout-")) {
        const payoutId = reference.replace("payout-", "");

        try {
          const payout = await prisma.sellerPayout.findUnique({
            where: { id: payoutId },
          });
          if (!payout) {
            logger.warn(`Payout not found for reference: ${reference}`);
            return res.status(200).json({ received: true });
          }

          if (transferData.status === "SUCCESSFUL") {
            await prisma.sellerPayout.update({
              where: { id: payoutId },
              data: {
                status: "COMPLETED",
                processedAt: new Date(),
                notes: `Flutterwave transfer completed. ID: ${transferData.id}`,
              },
            });
            logger.info(`Payout ${payoutId} completed via Flutterwave`);
          } else {
            // Failed: mark payout as FAILED and refund seller balance
            await prisma.$transaction([
              prisma.sellerPayout.update({
                where: { id: payoutId },
                data: {
                  status: "FAILED",
                  notes: `Flutterwave transfer failed: ${transferData.complete_message || "Unknown error"}`,
                },
              }),
              prisma.seller.update({
                where: { id: payout.sellerId },
                data: { balance: { increment: Number(payout.amount) } },
              }),
            ]);
            logger.info(`Payout ${payoutId} failed, balance refunded`);
          }
        } catch (err) {
          logger.error("Transfer webhook processing error", { error: err });
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    logger.error("Webhook error", { error });
    // Queue failed webhook for retry
    try {
      await prisma.webhookRetry.create({
        data: {
          provider: "flutterwave",
          eventType: req.body?.event || "unknown",
          payload: req.body || {},
          maxAttempts: 5,
          nextRetryAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });
    } catch (retryErr) {
      logger.error("Failed to queue webhook retry", { error: retryErr });
    }
    // Return 200 to prevent payment provider retries on processing errors
    return res.status(200).json({ error: "Webhook processing failed", received: true });
  }
}));

export default router;
