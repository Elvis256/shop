import { Router, Request, Response } from "express";
import { verifyFlutterwaveHash } from "../utils/verifyFlutterwave";
import prisma from "../lib/prisma";
const router = Router();

// POST /api/webhooks/flutterwave
router.post("/flutterwave", async (req: Request, res: Response) => {
  try {
    // Verify webhook signature
    const hash = req.headers["verif-hash"] as string | undefined;
    if (!verifyFlutterwaveHash(hash)) {
      console.warn("Invalid webhook hash received");
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { event, data } = req.body;

    if (event === "charge.completed") {
      const { tx_ref, status, flw_ref, amount, currency } = data;

      // Idempotency check - prevent duplicate processing
      const existingWebhook = await prisma.processedWebhook.findUnique({
        where: { webhookId: flw_ref },
      });

      if (existingWebhook) {
        console.log(`Webhook ${flw_ref} already processed, skipping`);
        return res.status(200).json({ received: true, duplicate: true });
      }

      // Find the order
      const order = await prisma.order.findUnique({
        where: { id: tx_ref },
        include: { payments: true },
      });

      if (!order) {
        console.warn(`Order not found for tx_ref: ${tx_ref}`);
        return res.status(404).json({ error: "Order not found" });
      }

      // Verify amount matches
      if (Number(order.totalAmount) !== amount) {
        console.warn(`Amount mismatch for order ${tx_ref}: expected ${order.totalAmount}, got ${amount}`);
        return res.status(400).json({ error: "Amount mismatch" });
      }

      // Process webhook in a transaction with idempotency record
      await prisma.$transaction(async (tx) => {
        // Record webhook as processed first (idempotency)
        await tx.processedWebhook.create({
          data: {
            webhookId: flw_ref,
            provider: "flutterwave",
            eventType: event,
          },
        });

        // Get stock reservations for this order
        const reservations = await tx.stockReservation.findMany({
          where: { orderId: tx_ref, released: false },
        });

        if (status === "successful") {
          await tx.payment.updateMany({
            where: { orderId: tx_ref },
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

          console.log(`✅ Order ${tx_ref} marked as CONFIRMED`);
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

          console.log(`❌ Order ${tx_ref} payment failed`);
        }
      });
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
