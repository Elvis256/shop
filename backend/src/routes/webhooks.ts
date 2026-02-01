import { Router, Request, Response } from "express";
import { verifyFlutterwaveHash } from "../utils/verifyFlutterwave";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
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

      // Update payment status
      if (status === "successful") {
        await prisma.payment.updateMany({
          where: { orderId: tx_ref },
          data: {
            status: "SUCCESSFUL",
            flwTxId: flw_ref,
          },
        });

        // Update order status
        await prisma.order.update({
          where: { id: tx_ref },
          data: { status: "CONFIRMED", paymentStatus: "SUCCESSFUL" },
        });

        console.log(`✅ Order ${tx_ref} marked as CONFIRMED`);
      } else {
        await prisma.payment.updateMany({
          where: { orderId: tx_ref },
          data: { status: "FAILED" },
        });

        await prisma.order.update({
          where: { id: tx_ref },
          data: { status: "CANCELLED", paymentStatus: "FAILED" },
        });

        console.log(`❌ Order ${tx_ref} payment failed`);
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
