import { Router, Request } from "express";
import prisma from "../lib/prisma";
import { authenticate, optionalAuth, requireAdmin, AuthRequest } from "../middleware/auth";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";
import { confirmPaidOrder } from "../services/orderConfirmation";

const router = Router();

// Get available mobile money providers
router.get("/providers", asyncHandler(async (req, res) => {
  try {
    const providers = await prisma.paymentProvider.findMany({
      where: { 
        type: "MOBILE_MONEY",
        isActive: true 
      },
      select: {
        id: true,
        name: true,
        code: true,
        currencies: true,
        feeType: true,
        feeValue: true,
      },
    });

    res.json({ providers });
  } catch (error) {
    logger.error("Get providers error", { error });
    res.status(500).json({ error: "Failed to fetch providers" });
  }
}));

// FIX H2: Require optionalAuth — authenticated users must own the order;
// guests must supply the order's customer email as a secondary verification.
router.post("/initiate", optionalAuth, asyncHandler(async (req: AuthRequest, res) => {
  try {
    const { orderId, provider, phoneNumber, amount, currency = "UGX", customerEmail } = req.body;

    if (!orderId || !provider || !phoneNumber || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate phone number format for Uganda
    const phoneRegex = /^(\+?256|0)?[7][0-9]{8}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({ error: "Invalid Ugandan phone number" });
    }

    // Normalize phone to international format
    let normalizedPhone = phoneNumber.replace(/\s+/g, "");
    if (normalizedPhone.startsWith("0")) {
      normalizedPhone = "+256" + normalizedPhone.slice(1);
    } else if (!normalizedPhone.startsWith("+")) {
      normalizedPhone = "+256" + normalizedPhone;
    }

    // Validate provider
    const providerData = await prisma.paymentProvider.findUnique({
      where: { code: provider },
    });

    if (!providerData || providerData.type !== "MOBILE_MONEY") {
      return res.status(400).json({ error: "Invalid payment provider" });
    }

    // Validate order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // FIX H2: Verify caller owns this order.
    // Authenticated users: must match userId or customerEmail.
    // Guest callers: must supply the order's customerEmail as proof.
    const user = (req as AuthRequest).user;
    if (user) {
      const ownsOrder = order.userId === user.id || order.customerEmail === user.email;
      if (!ownsOrder) {
        logger.warn("mobilemoney_initiate_unauthorized", { userId: user.id, orderId });
        return res.status(403).json({ error: "You are not authorized to initiate payment for this order" });
      }
    } else {
      // Guest order — require email verification
      if (!customerEmail || order.customerEmail.toLowerCase() !== String(customerEmail).toLowerCase()) {
        logger.warn("mobilemoney_initiate_guest_unverified", { orderId });
        return res.status(403).json({ error: "Please provide the email used at checkout to verify this order" });
      }
    }


    // Use order's total amount (authoritative) instead of client-supplied amount
    const orderAmount = Number(order.totalAmount);

    // Calculate fee based on authoritative order amount
    let fee = 0;
    if (providerData.feeType === "PERCENTAGE") {
      fee = (orderAmount * Number(providerData.feeValue)) / 100;
    } else {
      fee = Number(providerData.feeValue);
    }

    // Apply min/max fee limits
    if (providerData.minFee && fee < Number(providerData.minFee)) {
      fee = Number(providerData.minFee);
    }
    if (providerData.maxFee && fee > Number(providerData.maxFee)) {
      fee = Number(providerData.maxFee);
    }

    // Generate external reference
    const externalRef = `PZ-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Create transaction record
    const transaction = await prisma.mobileMoneyTransaction.create({
      data: {
        orderId,
        provider,
        phoneNumber: normalizedPhone,
        amount: orderAmount,
        currency,
        externalRef,
        status: "PENDING",
      },
    });

    // In production, this would call the actual mobile money API
    // For now, simulate the request
    const paymentRequest = {
      transactionId: transaction.id,
      externalRef,
      provider: providerData.name,
      phoneNumber: normalizedPhone,
      amount: orderAmount + fee,
      fee,
      currency,
      status: "PENDING",
      message: `Payment request sent to ${normalizedPhone}. Please enter your PIN to confirm.`,
      expiresIn: 300, // 5 minutes
    };

    // In production: Call MTN/Airtel API here
    // await callMobileMoneyAPI(provider, paymentRequest);

    res.json(paymentRequest);
  } catch (error) {
    logger.error("Mobile money initiate error", { error });
    res.status(500).json({ error: "Failed to initiate payment" });
  }
}));

// Check payment status
router.get("/status/:transactionId", authenticate, asyncHandler(async (req, res) => {
  try {
    const { transactionId } = req.params;

    const transaction = await prisma.mobileMoneyTransaction.findUnique({
      where: { id: transactionId },
      include: {
        order: {
          select: { orderNumber: true, status: true, paymentStatus: true },
        },
      },
    });

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    res.json({
      transactionId: transaction.id,
      externalRef: transaction.externalRef,
      status: transaction.status,
      statusMessage: transaction.statusMessage,
      amount: transaction.amount,
      currency: transaction.currency,
      provider: transaction.provider,
      order: transaction.order,
      initiatedAt: transaction.initiatedAt,
      completedAt: transaction.completedAt,
    });
  } catch (error) {
    logger.error("Check status error", { error });
    res.status(500).json({ error: "Failed to check payment status" });
  }
}));

// Callback endpoint for mobile money providers
router.post("/callback/:provider", asyncHandler(async (req, res) => {
  try {
    const { provider } = req.params;
    const payload = req.body;

    // Validate webhook signatures — REJECT if signature is missing
    if (provider === "mtn_ug") {
      const signature = req.headers["x-callback-signature"] as string | undefined;
      const secret = process.env.MTN_WEBHOOK_SECRET;
      if (!secret || !signature) {
        logger.warn("[MTN Callback] Missing webhook secret or signature — request rejected");
        return res.status(401).json({ error: "Missing signature — authentication required" });
      }
      const crypto = await import("crypto");
      const expected = crypto.createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        logger.warn("[MTN Callback] Invalid signature — request rejected");
        return res.status(401).json({ error: "Invalid signature" });
      }
    } else if (provider === "airtel_ug") {
      // Airtel uses Bearer token validation
      const authHeader = req.headers["authorization"] as string | undefined;
      const expectedToken = process.env.AIRTEL_CALLBACK_TOKEN;
      if (!expectedToken || !authHeader) {
        logger.warn("[Airtel Callback] Missing token — request rejected");
        return res.status(401).json({ error: "Missing authentication — token required" });
      }
      if (authHeader !== `Bearer ${expectedToken}`) {
        logger.warn("[Airtel Callback] Invalid token — request rejected");
        return res.status(401).json({ error: "Invalid token" });
      }
    }

    logger.info(`Mobile money callback from ${provider}`, { payload });

    // Extract reference and status based on provider format
    let externalRef: string | undefined;
    let status: "SUCCESSFUL" | "FAILED" | "CANCELLED";
    let transactionId: string | undefined;
    let statusMessage: string | undefined;

    // Handle different provider callback formats
    switch (provider) {
      case "mtn_ug":
        externalRef = payload.externalRef || payload.reference;
        status = payload.status === "SUCCESSFUL" ? "SUCCESSFUL" : "FAILED";
        transactionId = payload.transactionId;
        statusMessage = payload.reason || payload.message;
        break;
      case "airtel_ug":
        externalRef = payload.transaction?.id || payload.reference;
        status = payload.transaction?.status === "TS" ? "SUCCESSFUL" : "FAILED";
        transactionId = payload.transaction?.airtel_money_id;
        statusMessage = payload.transaction?.message;
        break;
      default:
        return res.status(400).json({ error: "Unknown provider" });
    }

    if (!externalRef) {
      return res.status(400).json({ error: "Missing transaction reference" });
    }

    // Find and update transaction
    const transaction = await prisma.mobileMoneyTransaction.findFirst({
      where: { externalRef },
    });

    if (!transaction) {
      logger.error(`Transaction not found for ref: ${externalRef}`);
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Update transaction status
    await prisma.mobileMoneyTransaction.update({
      where: { id: transaction.id },
      data: {
        status,
        statusMessage,
        transactionId,
        completedAt: new Date(),
      },
    });

    // If successful, update order payment status
    if (status === "SUCCESSFUL" && transaction.orderId) {
      const orderId = transaction.orderId;
      // Verify payment amount matches order total
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order) {
        logger.error(`Order not found for transaction ${transaction.id}`);
        return res.status(404).json({ error: "Order not found" });
      }
      if (Math.abs(Number(order.totalAmount) - Number(transaction.amount)) > 1) {
        logger.error(`Amount mismatch for order ${orderId}: expected ${order.totalAmount}, got ${transaction.amount}`);
        return res.status(400).json({ error: "Amount mismatch" });
      }
      // Guard: don't overwrite terminal payment status
      if (["SUCCESSFUL", "REFUNDED", "FAILED"].includes(order.paymentStatus)) {
        return res.json({ success: true, message: "Already processed" });
      }

      await prisma.$transaction(async (tx) => {
        await tx.orderEvent.create({
          data: {
            orderId: orderId,
            status: "PAYMENT_RECEIVED",
            note: `Mobile money payment confirmed via ${provider.toUpperCase()}`,
          },
        });

        // Use shared confirmation logic (status update, stock finalization,
        // seller earnings, escrow, variant support)
        await confirmPaidOrder(tx, orderId);
      });

      // Note: Cart is cleared on the frontend upon redirect to success page
    }

    res.json({ success: true });
  } catch (error) {
    logger.error("Mobile money callback error", { error });
    res.status(500).json({ error: "Callback processing failed" });
  }
}));

// Simulate payment completion (DEV/STAGING ONLY — blocked in production)
router.post("/simulate-complete/:transactionId", authenticate, requireAdmin, asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Simulation endpoint disabled in production" });
  }

  try {
    const { transactionId } = req.params;
    const { success = true } = req.body;

    const transaction = await prisma.mobileMoneyTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    const status = success ? "SUCCESSFUL" : "FAILED";

    await prisma.mobileMoneyTransaction.update({
      where: { id: transactionId },
      data: {
        status,
        statusMessage: success ? "Payment completed successfully" : "Payment failed - insufficient funds",
        completedAt: new Date(),
      },
    });

    if (success && transaction.orderId) {
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: transaction.orderId! },
          data: { 
            paymentStatus: "SUCCESSFUL",
            status: "CONFIRMED",
          },
        });
        await tx.orderEvent.create({
          data: {
            orderId: transaction.orderId!,
            status: "PAYMENT_RECEIVED",
            note: `Mobile money payment confirmed (${transaction.provider})`,
          },
        });

        // Use shared confirmation logic (stock, seller earnings, escrow, variants)
        await confirmPaidOrder(tx, transaction.orderId!);
      });
    }

    res.json({ success: true, status });
  } catch (error) {
    logger.error("Simulate complete error", { error });
    res.status(500).json({ error: "Failed to simulate payment" });
  }
}));

export default router;
