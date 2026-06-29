import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../middleware/auth";
import { sendWhatsApp } from "../services/whatsapp";
import { enqueueNotification } from "../services/notificationDispatcher";
import { sendSMS } from "../services/sms";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";
import crypto from "crypto";
import { approveAffiliateConversions } from "../utils/affiliateHelper";
import { awardPurchasePoints } from "./loyalty";

const router = Router();

function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

// POST /api/delivery/generate-otp/:orderId — Admin generates OTP for delivery
router.post("/generate-otp/:orderId", authenticate, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { orderId } = req.params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, status: true, customerPhone: true, deliveryOtp: true },
  });

  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  if (!["SHIPPED", "PROCESSING"].includes(order.status)) {
    return res.status(400).json({ error: "Order must be SHIPPED or PROCESSING to generate OTP" });
  }

  const otp = generateOtp();
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await prisma.order.update({
    where: { id: orderId },
    data: { deliveryOtp: otp, deliveryOtpExpiry: expiry },
  });

  // Send OTP to customer via WhatsApp and SMS
  if (order.customerPhone) {
    const msg = `Your delivery code for order ${order.orderNumber} is: ${otp}. Please share this code with the delivery agent to confirm receipt. Valid for 24 hours.`;
    await sendWhatsApp({ to: order.customerPhone, text: msg });
    await sendSMS(order.customerPhone, msg);
  }

  logger.info(`Delivery OTP generated for order ${orderId}`);
  return res.json({ success: true, message: "OTP sent to customer" });
}));

// POST /api/delivery/verify-otp — Delivery agent verifies OTP and collects COD balance
router.post("/verify-otp", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { orderId, otp, agentId } = req.body;

  if (!orderId || !otp) {
    return res.status(400).json({ error: "orderId and otp are required" });
  }

  // Only admin, manager, or approved seller may confirm deliveries.
  const userRole = req.user!.role;
  const allowedRoles = ["ADMIN", "MANAGER", "SELLER"];
  if (!allowedRoles.includes(userRole)) {
    return res.status(403).json({ error: "Insufficient permissions to confirm delivery" });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { select: { sellerId: true, price: true, quantity: true, commission: true, shippingFeeCharged: true } },
      payments: true,
      escrow: true,
    },
  });

  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  // Sellers may only confirm deliveries for orders that contain their own items.
  if (userRole === "SELLER") {
    const seller = await prisma.seller.findUnique({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    const hasSellerItem = order.items.some((item) => item.sellerId === seller?.id);
    if (!hasSellerItem) {
      return res.status(403).json({ error: "You can only confirm deliveries for your own products" });
    }
  }

  if (order.deliveryConfirmedAt) {
    return res.status(400).json({ error: "Delivery already confirmed" });
  }

  if (!order.deliveryOtp) {
    return res.status(400).json({ error: "No OTP generated for this order" });
  }

  if (order.deliveryOtpExpiry && order.deliveryOtpExpiry < new Date()) {
    return res.status(400).json({ error: "OTP has expired" });
  }

  if (order.deliveryOtp !== otp) {
    return res.status(400).json({ error: "Invalid OTP" });
  }

  // Locate the outstanding COD balance payment (the 80% remainder collected on delivery).
  const codPayment = order.payments.find((p) => p.provider === "cod" && p.method === "COD" && p.status === "PENDING");

  await prisma.$transaction(async (tx) => {
    if (codPayment) {
      await tx.payment.update({
        where: { id: codPayment.id },
        data: { status: "SUCCESSFUL" },
      });
    }

    const remainingPending = order.payments.filter(
      (p) => p.status === "PENDING" && (!codPayment || p.id !== codPayment.id)
    ).length;

    const isFullyPaid = remainingPending === 0;

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "DELIVERED",
        ...(isFullyPaid ? { paymentStatus: "SUCCESSFUL" } : {}),
        deliveryConfirmedAt: new Date(),
        deliveryConfirmedBy: agentId || req.user!.id,
        deliveryOtp: null, // Clear OTP after use
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId,
        status: "DELIVERED",
        note: codPayment
          ? `Delivery confirmed and COD balance collected via OTP by ${agentId || req.user!.id}`
          : `Delivery confirmed via OTP by ${agentId || req.user!.id}`,
      },
    });

    // Credit seller balances for COD orders (deposit was already credited at checkout confirmation).
    if (codPayment) {
      const sellerAmounts: Record<string, number> = {};
      for (const item of order.items) {
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
            pendingBalance: { increment: amount },
            totalEarnings: { increment: amount },
            totalSales: { increment: 1 },
          },
        });
      }
    }

    // Schedule escrow release after 7 days
    if (order.escrow && order.escrow.status === "HELD") {
      await tx.escrowTransaction.update({
        where: { id: order.escrow.id },
        data: { releaseDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      });
    }

    await approveAffiliateConversions(orderId, tx);
  });

  // Award loyalty points on delivery
  if (order.userId) {
    awardPurchasePoints(order.userId, Number(order.totalAmount), orderId)
      .catch(err => logger.error("Failed to award purchase points on delivery", { error: err }));
  }

  // Notify customer
  enqueueNotification({
    event: "ORDER_DELIVERED",
    recipientEmail: order.customerEmail || undefined,
    recipientPhone: order.customerPhone || undefined,
    recipientUserId: order.userId || undefined,
    orderId,
    data: {
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      orderId,
      total: Number(order.totalAmount),
      currency: order.currency || "UGX",
    },
  }).catch((err) => logger.error("Failed to enqueue delivery notification", { error: err }));

  logger.info(`Delivery confirmed for order ${orderId} by agent ${agentId || req.user!.id}`);
  return res.json({ success: true, message: "Delivery confirmed" });
}));

// GET /api/delivery/status/:orderId — Check OTP status
router.get("/status/:orderId", asyncHandler(async (req: Request, res: Response) => {
  const { orderId } = req.params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      deliveryOtp: true,
      deliveryOtpExpiry: true,
      deliveryConfirmedAt: true,
      deliveryConfirmedBy: true,
    },
  });

  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  return res.json({
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    otpGenerated: !!order.deliveryOtp,
    otpExpired: order.deliveryOtpExpiry ? order.deliveryOtpExpiry < new Date() : false,
    deliveryConfirmed: !!order.deliveryConfirmedAt,
    deliveryConfirmedAt: order.deliveryConfirmedAt,
    deliveryConfirmedBy: order.deliveryConfirmedBy,
  });
}));

export default router;
