import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest, requireAdmin } from "../middleware/auth";

const router = Router();

// POST /api/installments/create — Create installment plan for an order
router.post("/create", authenticate, async (req: AuthRequest, res: Response) => {
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
    console.error("Create installment plan error:", error);
    return res.status(500).json({ error: "Failed to create installment plan" });
  }
});

// GET /api/installments/my-plans — List user's installment plans
router.get("/my-plans", authenticate, async (req: AuthRequest, res: Response) => {
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
    console.error("Get installment plans error:", error);
    return res.status(500).json({ error: "Failed to fetch installment plans" });
  }
});

// POST /api/installments/pay/:planId — Mark next installment as paid
router.post("/pay/:planId", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { planId } = req.params;

    const plan = await prisma.installmentPlan.findUnique({
      where: { id: planId },
      include: {
        order: { select: { userId: true } },
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

    const newPaidCount = plan.paidCount + 1;
    const isCompleted = newPaidCount >= plan.installments;
    const intervalDays = plan.installments <= 2 ? 14 : 30;

    await prisma.$transaction([
      prisma.installmentPayment.update({
        where: { id: nextPayment.id },
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

    return res.json({ message: "Installment paid", paidCount: newPaidCount, completed: isCompleted });
  } catch (error) {
    console.error("Pay installment error:", error);
    return res.status(500).json({ error: "Failed to process installment payment" });
  }
});

// GET /api/installments/admin/overdue — List overdue plans (admin)
router.get("/admin/overdue", authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
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
    console.error("Get overdue plans error:", error);
    return res.status(500).json({ error: "Failed to fetch overdue plans" });
  }
});

export default router;
