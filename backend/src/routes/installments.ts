import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest, requireAdmin } from "../middleware/auth";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";
import { createFlutterwavePayment } from "../services/flutterwave";

const router = Router();

// POST /api/installments/create — Create installment plan for an order
router.post("/create", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { orderId, installments } = req.body;

    if (!orderId || ![2, 3, 4].includes(installments)) {
      return res.status(400).json({ error: "orderId required and installments must be 2, 3, or 4" });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    if (order.userId !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const existing = await prisma.installmentPlan.findUnique({ where: { orderId } });
    if (existing) {
      return res.status(400).json({ error: "Installment plan already exists for this order" });
    }

    const totalAmount = Number(order.totalAmount);
    const perInstallment = Math.ceil(totalAmount / installments);
    const intervalDays = installments <= 2 ? 14 : 30;

    const plan = await prisma.installmentPlan.create({
      data: {
        orderId,
        totalAmount,
        installments,
        paidCount: 1,
        nextDueDate: new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000),
        status: "ACTIVE",
        payments: {
          create: Array.from({ length: installments }, (_, i) => ({
            number: i + 1,
            amount: perInstallment,
            status: i === 0 ? "PAID" : "PENDING",
            dueDate: new Date(Date.now() + i * intervalDays * 24 * 60 * 60 * 1000),
            paidAt: i === 0 ? new Date() : null,
          })),
        },
      },
      include: { payments: { orderBy: { number: "asc" } } },
    });

    return res.status(201).json({ plan });
  } catch (error) {
    logger.error("Create installment plan error", { error });
    return res.status(500).json({ error: "Failed to create installment plan" });
  }
}));

// GET /api/installments/my-plans — List user's installment plans
router.get("/my-plans", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const plans = await prisma.installmentPlan.findMany({
      where: { order: { userId } },
      include: {
        payments: { orderBy: { number: "asc" } },
        order: { select: { orderNumber: true, totalAmount: true, currency: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ plans });
  } catch (error) {
    logger.error("Get installment plans error", { error });
    return res.status(500).json({ error: "Failed to fetch installment plans" });
  }
}));

// POST /api/installments/pay/:planId — Initiate Flutterwave payment for next installment
router.post("/pay/:planId", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { planId } = req.params;
    const { paymentMethod, mobileNetwork, mobilePhone } = req.body;

    const plan = await prisma.installmentPlan.findUnique({
      where: { id: planId },
      include: {
        order: { select: { userId: true, customerName: true, customerEmail: true, currency: true, id: true } },
        payments: { orderBy: { number: "asc" } },
      },
    });

    if (!plan) {
      return res.status(404).json({ error: "Installment plan not found" });
    }
    if (plan.order.userId !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }
    if (plan.status !== "ACTIVE" && plan.status !== "OVERDUE") {
      return res.status(400).json({ error: "Plan is not active" });
    }

    const nextPayment = plan.payments.find((p) => p.status === "PENDING" || p.status === "OVERDUE");
    if (!nextPayment) {
      return res.status(400).json({ error: "All installments already paid" });
    }

    const tx_ref = `installment-${planId}-${nextPayment.id}`;
    const BASE_URL = process.env.FRONTEND_URL || "https://ugsex.com";

    const flwPayload: any = {
      tx_ref,
      amount: Number(nextPayment.amount),
      currency: plan.order.currency || "UGX",
      customer: {
        name: plan.order.customerName,
        email: plan.order.customerEmail,
      },
      paymentMethod: paymentMethod || "mobile_money",
      redirect_url: `${BASE_URL}/account/orders`,
      meta: { planId, paymentId: nextPayment.id, orderId: plan.order.id },
    };

    if (paymentMethod === "mobile_money" && mobileNetwork && mobilePhone) {
      flwPayload.mobileMoney = { network: mobileNetwork, phone: mobilePhone };
    }

    const result = await createFlutterwavePayment(flwPayload);

    // Create a Payment record to track this transaction
    await prisma.payment.create({
      data: {
        orderId: plan.order.id,
        amount: Number(nextPayment.amount),
        currency: plan.order.currency || "UGX",
        method: paymentMethod || "MOBILE_MONEY",
        status: "PENDING",
        flwRef: tx_ref,
      },
    });

    return res.json({ paymentLink: result.data?.link, tx_ref });
  } catch (error) {
    logger.error("Pay installment error", { error });
    return res.status(500).json({ error: "Failed to process installment payment" });
  }
}));

// GET /api/installments/admin/overdue — List overdue plans (admin)
router.get("/admin/overdue", authenticate, requireAdmin, asyncHandler(async (_req: AuthRequest, res: Response) => {
  try {
    const overduePlans = await prisma.installmentPlan.findMany({
      where: {
        status: { in: ["ACTIVE", "OVERDUE"] },
        nextDueDate: { lt: new Date() },
      },
      include: {
        order: {
          select: { orderNumber: true, customerName: true, customerEmail: true, totalAmount: true, currency: true },
        },
        payments: { orderBy: { number: "asc" } },
      },
      orderBy: { nextDueDate: "asc" },
    });

    return res.json({ overduePlans });
  } catch (error) {
    logger.error("Get overdue plans error", { error });
    return res.status(500).json({ error: "Failed to fetch overdue plans" });
  }
}));

export default router;
