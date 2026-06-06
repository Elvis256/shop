import { Router, Request, Response } from "express";
import { verifyFlutterwaveHash } from "../utils/verifyFlutterwave";
import prisma from "../lib/prisma";
import { placeAliExpressOrdersForOrder } from "../services/aliexpressOrder";
import { placeCJOrdersForOrder } from "../services/cjOrder";
import { getCommissionRate } from "./seller";
import { handleLayawayPayment } from "./layaway";
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

    if (event === "charge.completed") {
      const tx_ref = data.tx_ref;
      const status = data.status;
      const flw_ref = data.flw_ref;
      const amount = data.amount;
      const currency = data.currency;

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
        where: { id: tx_ref },
        include: { payments: true },
      });

      if (!order) {
        logger.warn(`Order not found for tx_ref: ${tx_ref}`);
        return res.status(200).json({ error: "Order not found", received: true });
      }

      // Verify amount AND currency match
      if (currency !== order.currency) {
        logger.warn(`Currency mismatch for order ${tx_ref}: expected ${order.currency}, got ${currency}`);
        return res.status(200).json({ error: "Currency mismatch", received: true });
      }
      // Compare against the payment record amount (handles installments correctly)
      const matchingPayment = order.payments.find(p => p.flwRef === flw_ref);
      const expectedAmount = matchingPayment ? Number(matchingPayment.amount) : Number(order.totalAmount);
      if (expectedAmount !== amount) {
        logger.warn(`Amount mismatch for order ${tx_ref}: expected ${expectedAmount}, got ${amount}`);
        return res.status(200).json({ error: "Amount mismatch", received: true });
      }

      // Process webhook in a transaction
      await prisma.$transaction(async (tx) => {
        // Get stock reservations for this order
        const reservations = await tx.stockReservation.findMany({
          where: { orderId: tx_ref, released: false },
        });

        if (status === "successful") {
          // Guard: reject if order already has a terminal payment status
          const existingOrder = await tx.order.findUnique({
            where: { id: tx_ref },
            select: { paymentStatus: true },
          });
          if (existingOrder?.paymentStatus === "SUCCESSFUL") {
            logger.info(`Order ${tx_ref} already paid, skipping duplicate confirmation`);
            return;
          }

          await tx.payment.updateMany({
            where: { orderId: tx_ref, flwRef: flw_ref },
            data: {
              status: "SUCCESSFUL",
              flwTxId: flw_ref,
            },
          });

          await tx.order.update({
            where: { id: tx_ref },
            data: { status: "CONFIRMED", paymentStatus: "SUCCESSFUL" },
          });

          // Finalize stock: decrement actual stock, release reservation
          for (const reservation of reservations) {
            await tx.product.update({
              where: { id: reservation.productId },
              data: {
                stock: { decrement: reservation.quantity },
                reservedStock: { decrement: reservation.quantity },
              },
            });
            
            await tx.stockReservation.update({
              where: { id: reservation.id },
              data: { released: true },
            });
          }

          // Credit seller earnings for marketplace items
          const sellerItems = await tx.orderItem.findMany({
            where: { orderId: tx_ref, sellerId: { not: null } },
            include: { product: { select: { categoryId: true } } },
          });

          // Group earnings by seller
          const sellerEarnings: Record<string, { net: number; sales: number }> = {};
          for (const item of sellerItems) {
            const rate = await getCommissionRate(item.sellerId!, item.product?.categoryId || null);
            const itemTotal = Number(item.price) * item.quantity;
            const commission = Math.round((itemTotal * rate) / 100);
            const net = itemTotal - commission;

            await tx.orderItem.update({
              where: { id: item.id },
              data: { commission },
            });

            if (!sellerEarnings[item.sellerId!]) {
              sellerEarnings[item.sellerId!] = { net: 0, sales: 0 };
            }
            sellerEarnings[item.sellerId!].net += net;
            sellerEarnings[item.sellerId!].sales += item.quantity;
          }

          // Update each seller's balance, totalEarnings, totalSales
          for (const [sellerId, earnings] of Object.entries(sellerEarnings)) {
            await tx.seller.update({
              where: { id: sellerId },
              data: {
                balance: { increment: earnings.net },
                totalEarnings: { increment: earnings.net },
                totalSales: { increment: earnings.sales },
              },
            });
          }

          logger.info(`Order ${tx_ref} marked as CONFIRMED`);
        } else {
          await tx.payment.updateMany({
            where: { orderId: tx_ref },
            data: { status: "FAILED" },
          });

          await tx.order.update({
            where: { id: tx_ref },
            data: { status: "CANCELLED", paymentStatus: "FAILED" },
          });

          // Release reserved stock back to available
          for (const reservation of reservations) {
            await tx.product.update({
              where: { id: reservation.productId },
              data: {
                reservedStock: { decrement: reservation.quantity },
              },
            });
            
            await tx.stockReservation.update({
              where: { id: reservation.id },
              data: { released: true },
            });
          }

          logger.info(`Order ${tx_ref} payment failed`);
        }
      });

      // After successful payment: place dropshipping orders
      // Note: Cart is cleared on the frontend upon redirect to success page
      if (status === "successful") {

        placeAliExpressOrdersForOrder(tx_ref).catch((err) => {
          logger.error(`AliExpress auto-order failed for ${tx_ref}`, { error: err.message });
        });
        placeCJOrdersForOrder(tx_ref).catch((err) => {
          logger.error(`CJ auto-order failed for ${tx_ref}`, { error: err.message });
        });
      }
    }

    // Handle installment payment webhooks
    if (event === "charge.completed" && data.tx_ref?.startsWith("installment-")) {
      const parts = data.tx_ref.split("-");
      // format: installment-{planId}-{paymentId}
      if (parts.length >= 3) {
        const planId = parts[1];
        const paymentId = parts.slice(2).join("-");
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
    // Return 200 to prevent payment provider retries on processing errors
    return res.status(200).json({ error: "Webhook processing failed", received: true });
  }
}));

export default router;
