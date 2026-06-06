import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../middleware/auth";
import { sendWhatsApp } from "../services/whatsapp";
import { sendSMS } from "../services/sms";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";
import crypto from "crypto";

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

// POST /api/delivery/verify-otp — Delivery agent verifies OTP
router.post("/verify-otp", asyncHandler(async (req: Request, res: Response) => {
  const { orderId, otp, agentId } = req.body;

  if (!orderId || !otp) {
    return res.status(400).json({ error: "orderId and otp are required" });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      deliveryOtp: true,
      deliveryOtpExpiry: true,
      deliveryConfirmedAt: true,
      status: true,
      customerPhone: true,
    },
  });

  if (!order) {
    return res.status(404).json({ error: "Order not found" });
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

  // Mark as delivered
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "DELIVERED",
        deliveryConfirmedAt: new Date(),
        deliveryConfirmedBy: agentId || "delivery-agent",
        deliveryOtp: null, // Clear OTP after use
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId,
        status: "DELIVERED",
        note: `Delivery confirmed via OTP by ${agentId || "delivery-agent"}`,
      },
    });

    // Release escrow after 7 days
    const escrow = await tx.escrowTransaction.findUnique({ where: { orderId } });
    if (escrow && escrow.status === "HELD") {
      await tx.escrowTransaction.update({
        where: { id: escrow.id },
        data: { releaseDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      });
    }
  });

  // Notify customer
  if (order.customerPhone) {
    await sendWhatsApp({
      to: order.customerPhone,
      text: `Your order ${order.orderNumber} has been delivered and confirmed. Thank you for shopping with PleasureZone!`,
    });
  }

  logger.info(`Delivery confirmed for order ${orderId} by agent ${agentId}`);
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
