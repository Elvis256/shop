import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { createFlutterwavePayment } from "../services/flutterwave";
import { sendWhatsApp } from "../services/whatsapp";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";
import crypto from "crypto";

const router = Router();

const FREQUENCY_DAYS: Record<string, number> = {
  DAILY: 1,
  WEEKLY: 7,
  BIWEEKLY: 14,
};

// POST /api/layaway — Create a layaway plan
router.post("/", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { productId, frequency } = req.body;

  if (!productId || !frequency || !FREQUENCY_DAYS[frequency]) {
    return res.status(400).json({ error: "productId and frequency (DAILY/WEEKLY/BIWEEKLY) required" });
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, price: true, stock: true },
  });

  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }

  if (product.stock <= 0) {
    return res.status(400).json({ error: "Product is out of stock" });
  }

  // Check for existing active plan for same product
  const existing = await prisma.layawayPlan.findFirst({
    where: { userId, productId, status: "ACTIVE" },
  });

  if (existing) {
    return res.status(400).json({ error: "You already have an active plan for this product" });
  }

  const targetAmount = Number(product.price);
  const intervalDays = FREQUENCY_DAYS[frequency];

  // Calculate installment amount: spread over 30 days for daily, ~4 weeks for weekly, ~2 payments for biweekly
  let numPayments: number;
  if (frequency === "DAILY") numPayments = 30;
  else if (frequency === "WEEKLY") numPayments = 4;
  else numPayments = 2;

  const installmentAmount = Math.ceil(targetAmount / numPayments);

  const plan = await prisma.layawayPlan.create({
    data: {
      userId,
      productId,
      targetAmount,
      frequency,
      installmentAmount,
      nextPaymentDate: new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000),
    },
    include: { product: { select: { name: true, price: true } } },
  });

  return res.status(201).json({
    plan,
    message: `Layaway plan created! Pay UGX ${installmentAmount.toLocaleString()} ${frequency.toLowerCase()} to own ${product.name}.`,
  });
}));

// GET /api/layaway — List user's layaway plans
router.get("/", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const plans = await prisma.layawayPlan.findMany({
    where: { userId: req.user!.id },
    include: {
      product: {
        select: { id: true, name: true, slug: true, price: true, images: { select: { url: true }, take: 1 } },
      },
      payments: { orderBy: { createdAt: "desc" }, take: 5 },
    },
    orderBy: { createdAt: "desc" },
  });

  return res.json({
    plans: plans.map(p => ({
      ...p,
      progress: Math.round((Number(p.paidAmount) / Number(p.targetAmount)) * 100),
      remaining: Number(p.targetAmount) - Number(p.paidAmount),
    })),
  });
}));

// GET /api/layaway/:id — Plan detail with payment history
router.get("/:id", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const plan = await prisma.layawayPlan.findUnique({
    where: { id: req.params.id },
    include: {
      product: {
        select: { id: true, name: true, slug: true, price: true, images: { select: { url: true }, take: 1 } },
      },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!plan || plan.userId !== req.user!.id) {
    return res.status(404).json({ error: "Plan not found" });
  }

  return res.json({
    plan: {
      ...plan,
      progress: Math.round((Number(plan.paidAmount) / Number(plan.targetAmount)) * 100),
      remaining: Number(plan.targetAmount) - Number(plan.paidAmount),
    },
  });
}));

// POST /api/layaway/:id/pay — Initiate payment for layaway plan
router.post("/:id/pay", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { paymentMethod, mobileNetwork, mobilePhone } = req.body;

  const plan = await prisma.layawayPlan.findUnique({
    where: { id: req.params.id },
    include: { product: { select: { name: true } } },
  });

  if (!plan || plan.userId !== userId) {
    return res.status(404).json({ error: "Plan not found" });
  }

  if (plan.status !== "ACTIVE") {
    return res.status(400).json({ error: "Plan is not active" });
  }

  const remaining = Number(plan.targetAmount) - Number(plan.paidAmount);
  const payAmount = Math.min(Number(plan.installmentAmount), remaining);

  // Create payment record
  const payment = await prisma.layawayPayment.create({
    data: {
      planId: plan.id,
      amount: payAmount,
      status: "PENDING",
    },
  });

  const tx_ref = `layaway-${plan.id}-${payment.id}`;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  const BASE_URL = process.env.FRONTEND_URL || "https://ugsex.com";

  const flwPayload: any = {
    tx_ref,
    amount: payAmount,
    currency: "UGX",
    customer: { name: user?.name || "", email: user?.email || "" },
    paymentMethod: paymentMethod || "mobile_money",
    redirect_url: `${BASE_URL}/account/layaway`,
    meta: { planId: plan.id, paymentId: payment.id },
  };

  if (paymentMethod === "mobile_money" && mobileNetwork && mobilePhone) {
    flwPayload.mobileMoney = { network: mobileNetwork, phone: mobilePhone };
  }

  try {
    const result = await createFlutterwavePayment(flwPayload);
    await prisma.layawayPayment.update({
      where: { id: payment.id },
      data: { flwRef: tx_ref },
    });

    return res.json({ paymentLink: result.data?.link, tx_ref, amount: payAmount });
  } catch (error) {
    logger.error("Layaway payment error", { error });
    await prisma.layawayPayment.delete({ where: { id: payment.id } });
    return res.status(500).json({ error: "Payment initiation failed" });
  }
}));

// POST /api/layaway/:id/cancel — Cancel plan and issue store credit
router.post("/:id/cancel", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  const plan = await prisma.layawayPlan.findUnique({
    where: { id: req.params.id },
  });

  if (!plan || plan.userId !== userId) {
    return res.status(404).json({ error: "Plan not found" });
  }

  if (plan.status !== "ACTIVE") {
    return res.status(400).json({ error: "Plan is not active" });
  }

  const paidAmount = Number(plan.paidAmount);

  await prisma.$transaction(async (tx) => {
    await tx.layawayPlan.update({
      where: { id: plan.id },
      data: { status: "CANCELLED" },
    });

    // Issue store credit for paid amount
    if (paidAmount > 0) {
      await tx.storeCredit.upsert({
        where: { userId },
        update: { balance: { increment: paidAmount } },
        create: { userId, balance: paidAmount },
      });
    }
  });

  return res.json({
    message: paidAmount > 0
      ? `Plan cancelled. UGX ${paidAmount.toLocaleString()} added to your store credit.`
      : "Plan cancelled.",
    storeCreditAdded: paidAmount,
  });
}));

// Webhook handler: called from webhooks.ts for layaway payments
export async function handleLayawayPayment(planId: string, paymentId: string, status: string): Promise<void> {
  try {
    if (status !== "successful") {
      await prisma.layawayPayment.update({
        where: { id: paymentId },
        data: { status: "FAILED" },
      });
      return;
    }

    const payment = await prisma.layawayPayment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.status === "PAID") return;

    const plan = await prisma.layawayPlan.findUnique({
      where: { id: planId },
      include: {
        product: { select: { id: true, name: true, price: true, stock: true, sellerId: true, allowBackorder: true } },
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    });
    if (!plan) return;

    const newPaidAmount = Number(plan.paidAmount) + Number(payment.amount);
    const isCompleted = newPaidAmount >= Number(plan.targetAmount);
    const intervalDays = FREQUENCY_DAYS[plan.frequency] || 7;

    await prisma.$transaction(async (tx) => {
      await tx.layawayPayment.update({
        where: { id: paymentId },
        data: { status: "PAID", paidAt: new Date() },
      });

      await tx.layawayPlan.update({
        where: { id: planId },
        data: {
          paidAmount: newPaidAmount,
          status: isCompleted ? "COMPLETED" : "ACTIVE",
          completedAt: isCompleted ? new Date() : undefined,
          nextPaymentDate: isCompleted
            ? plan.nextPaymentDate
            : new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000),
        },
      });

      // Auto-create order when plan completes
      if (isCompleted) {
        const canFulfill = plan.product.stock > 0 || plan.product.allowBackorder;
        if (canFulfill) {
          const orderNumber = `LAY-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

          const order = await tx.order.create({
            data: {
              orderNumber,
              userId: plan.userId,
              customerName: plan.user.name || "",
              customerEmail: plan.user.email,
              customerPhone: plan.user.phone || "",
              shippingAddress: "{}",
              subtotal: Number(plan.targetAmount),
              totalAmount: Number(plan.targetAmount),
              currency: "UGX",
              status: "PENDING",
              paymentStatus: "SUCCESSFUL",
              items: {
                create: {
                  productId: plan.product.id,
                  name: plan.product.name,
                  price: Number(plan.product.price),
                  quantity: 1,
                  sellerId: plan.product.sellerId,
                },
              },
            },
          });

          await tx.layawayPlan.update({
            where: { id: planId },
            data: { orderId: order.id },
          });

          // Decrement stock
          await tx.product.update({
            where: { id: plan.product.id },
            data: { stock: { decrement: 1 } },
          });

          // Notify customer
          if (plan.user.phone) {
            sendWhatsApp({
              to: plan.user.phone,
              text: `🎉 Congratulations! Your layaway plan for ${plan.product.name} is complete! Order ${orderNumber} has been created. Please complete your shipping address details to start delivery: https://ugsex.com/account/orders/${order.id}`,
            }).catch(() => {});
          }
        } else {
          // Out of stock and backorders disabled: refund full amount to store credit and cancel plan
          await tx.layawayPlan.update({
            where: { id: planId },
            data: { status: "CANCELLED" },
          });

          await tx.storeCredit.upsert({
            where: { userId: plan.userId },
            update: { balance: { increment: newPaidAmount } },
            create: { userId: plan.userId, balance: newPaidAmount },
          });

          if (plan.user.phone) {
            sendWhatsApp({
              to: plan.user.phone,
              text: `⚠️ Your layaway plan for ${plan.product.name} has been completed, but the item is currently out of stock. We have refunded the paid amount of UGX ${newPaidAmount.toLocaleString()} to your store credit.`,
            }).catch(() => {});
          }
        }
      }
    });

    logger.info(`Layaway payment ${paymentId} processed for plan ${planId}`);
  } catch (error) {
    logger.error("Handle layaway payment error", { error, planId, paymentId });
  }
}

export default router;
