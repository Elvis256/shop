import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

// Get available mobile money providers
router.get("/providers", async (req, res) => {
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
    console.error("Get providers error:", error);
    res.status(500).json({ error: "Failed to fetch providers" });
  }
});

// Initiate mobile money payment
router.post("/initiate", async (req, res) => {
  try {
    const { orderId, provider, phoneNumber, amount, currency = "UGX" } = req.body;

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

    // Calculate fee
    let fee = 0;
    if (providerData.feeType === "PERCENTAGE") {
      fee = (amount * Number(providerData.feeValue)) / 100;
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
        amount,
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
      amount: amount + fee,
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
    console.error("Mobile money initiate error:", error);
    res.status(500).json({ error: "Failed to initiate payment" });
  }
});

// Check payment status
router.get("/status/:transactionId", async (req, res) => {
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
    console.error("Check status error:", error);
    res.status(500).json({ error: "Failed to check payment status" });
  }
});

// Callback endpoint for mobile money providers
router.post("/callback/:provider", async (req, res) => {
  try {
    const { provider } = req.params;
    const payload = req.body;

    console.log(`Mobile money callback from ${provider}:`, payload);

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
      console.error(`Transaction not found for ref: ${externalRef}`);
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
      await prisma.$transaction([
        prisma.order.update({
          where: { id: transaction.orderId },
          data: { 
            paymentStatus: "SUCCESSFUL",
            status: "CONFIRMED",
          },
        }),
        prisma.orderEvent.create({
          data: {
            orderId: transaction.orderId,
            status: "Payment Received",
            note: `Mobile money payment confirmed via ${provider.toUpperCase()}`,
          },
        }),
      ]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Mobile money callback error:", error);
    res.status(500).json({ error: "Callback processing failed" });
  }
});

// Simulate payment completion (for testing)
router.post("/simulate-complete/:transactionId", async (req, res) => {
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
      await prisma.$transaction([
        prisma.order.update({
          where: { id: transaction.orderId },
          data: { 
            paymentStatus: "SUCCESSFUL",
            status: "CONFIRMED",
          },
        }),
        prisma.orderEvent.create({
          data: {
            orderId: transaction.orderId,
            status: "Payment Received",
            note: `Mobile money payment confirmed (${transaction.provider})`,
          },
        }),
      ]);
    }

    res.json({ success: true, status });
  } catch (error) {
    console.error("Simulate complete error:", error);
    res.status(500).json({ error: "Failed to simulate payment" });
  }
});

export default router;
