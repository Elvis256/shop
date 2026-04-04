import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest, requireAdmin } from "../middleware/auth";

const router = Router();

// GET /api/store-credit — Get current user's balance + transaction history
router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const credit = await prisma.storeCredit.findUnique({
      where: { userId: req.user!.id },
      include: {
        transactions: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!credit) {
      return res.json({ balance: 0, transactions: [] });
    }

    return res.json({
      balance: credit.balance,
      transactions: credit.transactions.map((tx) => ({
        id: tx.id,
        amount: tx.amount,
        type: tx.type,
        description: tx.description,
        orderId: tx.orderId,
        createdAt: tx.createdAt,
      })),
    });
  } catch (error) {
    console.error("Get store credit error:", error);
    return res.status(500).json({ error: "Failed to fetch store credit" });
  }
});

// POST /api/store-credit/apply — Apply store credit to an order
router.post(
  "/apply",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const schema = z.object({
        amount: z.number().positive(),
        orderId: z.string(),
      });

      const { amount, orderId } = schema.parse(req.body);

      // Verify order exists and belongs to user
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      if (order.userId !== req.user!.id) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const result = await prisma.$transaction(async (tx) => {
        // Get or create store credit record
        let credit = await tx.storeCredit.findUnique({
          where: { userId: req.user!.id },
        });

        if (!credit || Number(credit.balance) < amount) {
          throw new Error("INSUFFICIENT_BALANCE");
        }

        // Deduct balance
        credit = await tx.storeCredit.update({
          where: { userId: req.user!.id },
          data: { balance: { decrement: amount } },
        });

        // Create transaction record
        const transaction = await tx.storeCreditTx.create({
          data: {
            storeCreditId: credit.id,
            amount: -amount,
            type: "REDEMPTION",
            description: `Applied to order ${order.orderNumber || orderId}`,
            orderId,
          },
        });

        return { balance: credit.balance, transaction };
      });

      return res.json({
        message: "Store credit applied",
        balance: result.balance,
        transaction: result.transaction,
      });
    } catch (error: any) {
      if (error.message === "INSUFFICIENT_BALANCE") {
        return res.status(400).json({ error: "Insufficient store credit balance" });
      }
      console.error("Apply store credit error:", error);
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      return res.status(500).json({ error: "Failed to apply store credit" });
    }
  }
);

// ─── Admin Routes ────────────────────────────────────────────────────────────

// GET /api/store-credit/admin/search?email=... — Search users for store credit
router.get(
  "/admin/search",
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { email } = req.query;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email query is required" });
      }

      const users = await prisma.user.findMany({
        where: {
          email: { contains: email, mode: "insensitive" },
        },
        take: 10,
        select: {
          id: true,
          name: true,
          email: true,
          storeCredit: {
            select: { balance: true },
          },
        },
      });

      return res.json({
        users: users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          balance: u.storeCredit?.balance || 0,
        })),
      });
    } catch (error) {
      console.error("Search users for store credit error:", error);
      return res.status(500).json({ error: "Failed to search users" });
    }
  }
);

// POST /api/store-credit/admin/add — Add credit to user
router.post(
  "/admin/add",
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const schema = z.object({
        userId: z.string(),
        amount: z.number().positive(),
        description: z.string().max(500).optional(),
      });

      const body = schema.parse(req.body);

      // Verify user exists
      const user = await prisma.user.findUnique({
        where: { id: body.userId },
      });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const result = await prisma.$transaction(async (tx) => {
        // Upsert store credit record
        const credit = await tx.storeCredit.upsert({
          where: { userId: body.userId },
          create: {
            userId: body.userId,
            balance: body.amount,
          },
          update: {
            balance: { increment: body.amount },
          },
        });

        // Create transaction record
        const transaction = await tx.storeCreditTx.create({
          data: {
            storeCreditId: credit.id,
            amount: body.amount,
            type: "MANUAL",
            description: body.description || "Admin credit",
          },
        });

        return { balance: credit.balance, transaction };
      });

      return res.status(201).json({
        message: "Store credit added",
        balance: result.balance,
        transaction: result.transaction,
      });
    } catch (error) {
      console.error("Admin add store credit error:", error);
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      return res.status(500).json({ error: "Failed to add store credit" });
    }
  }
);

// GET /api/store-credit/admin/:userId — View user's credit details
router.get(
  "/admin/:userId",
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { userId } = req.params;

      const credit = await prisma.storeCredit.findUnique({
        where: { userId },
        include: {
          transactions: {
            orderBy: { createdAt: "desc" },
          },
          user: { select: { name: true, email: true } },
        },
      });

      if (!credit) {
        return res.json({ balance: 0, transactions: [], user: null });
      }

      return res.json({
        balance: credit.balance,
        user: credit.user,
        transactions: credit.transactions.map((tx) => ({
          id: tx.id,
          amount: tx.amount,
          type: tx.type,
          description: tx.description,
          orderId: tx.orderId,
          createdAt: tx.createdAt,
        })),
      });
    } catch (error) {
      console.error("Admin get store credit error:", error);
      return res.status(500).json({ error: "Failed to fetch store credit" });
    }
  }
);

export default router;
