import { Router, Response } from "express";
import { ReturnReason, ReturnStatus } from "@prisma/client";
import { z } from "zod";
import { authenticate, optionalAuth, AuthRequest, requireAdmin } from "../middleware/auth";
import prisma from "../lib/prisma";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

// Create return request schema
const createReturnSchema = z.object({
  orderId: z.string(),
  reason: z.nativeEnum(ReturnReason),
  description: z.string().optional(),
  items: z.array(z.object({
    orderItemId: z.string(),
    quantity: z.number().min(1),
    reason: z.string().optional(),
    condition: z.enum(["unopened", "opened", "damaged"]).optional(),
  })).min(1),
});

// Create a return request
router.post("/", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const data = createReturnSchema.parse(req.body);
    const userId = req.user?.id;

    // Verify order belongs to user
    const order = await prisma.order.findFirst({
      where: {
        id: data.orderId,
        userId: userId,
        status: { in: ["DELIVERED", "SHIPPED"] },
      },
      include: { items: true },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found or not eligible for return" });
    }

    // Check if return already exists
    const existingReturn = await prisma.returnRequest.findFirst({
      where: {
        orderId: data.orderId,
        status: { notIn: ["REJECTED", "CLOSED"] },
      },
    });

    if (existingReturn) {
      return res.status(400).json({ error: "A return request already exists for this order" });
    }

    // Create return request
    const returnRequest = await prisma.returnRequest.create({
      data: {
        orderId: data.orderId,
        userId: userId,
        reason: data.reason,
        description: data.description,
        items: {
          create: data.items.map(item => ({
            orderItemId: item.orderItemId,
            quantity: item.quantity,
            reason: item.reason,
            condition: item.condition,
          })),
        },
      },
      include: {
        items: true,
        order: {
          select: {
            orderNumber: true,
            totalAmount: true,
          },
        },
      },
    });

    res.status(201).json({ returnRequest });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    logger.error("Create return error", { error });
    res.status(500).json({ error: "Failed to create return request" });
  }
}));

// Get user's return requests
router.get("/", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    const returns = await prisma.returnRequest.findMany({
      where: { userId },
      include: {
        items: true,
        order: {
          select: {
            orderNumber: true,
            totalAmount: true,
            currency: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ returns });
  } catch (error) {
    logger.error("Get returns error", { error });
    res.status(500).json({ error: "Failed to fetch return requests" });
  }
}));

// GET /api/returns/admin/all — List all return requests (admin)
router.get("/admin/all", authenticate, requireAdmin, asyncHandler(async (_req: AuthRequest, res: Response) => {
  try {
    const returns = await prisma.returnRequest.findMany({
      include: {
        order: { select: { orderNumber: true, totalAmount: true, customerName: true, customerEmail: true } },
        user: { select: { name: true, email: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(returns);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}));

// PUT /api/returns/:id/status — Update return status (admin)
router.put("/:id/status", authenticate, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { status, adminNotes, refundAmount, refundMethod } = req.body;
    const updated = await prisma.returnRequest.update({
      where: { id: req.params.id },
      data: {
        status,
        adminNotes,
        refundAmount: refundAmount ? parseFloat(refundAmount) : undefined,
        refundMethod,
        processedAt: ["APPROVED", "REJECTED", "REFUNDED"].includes(status) ? new Date() : undefined,
      },
      include: {
        order: { select: { orderNumber: true } },
        items: true,
      },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}));

// Get single return request
router.get("/:id", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const returnRequest = await prisma.returnRequest.findFirst({
      where: { id, userId },
      include: {
        items: true,
        order: {
          include: {
            items: {
              include: {
                product: {
                  select: { name: true, slug: true },
                },
              },
            },
          },
        },
      },
    });

    if (!returnRequest) {
      return res.status(404).json({ error: "Return request not found" });
    }

    res.json({ returnRequest });
  } catch (error) {
    logger.error("Get return error", { error });
    res.status(500).json({ error: "Failed to fetch return request" });
  }
}));

// Cancel return request (only if pending)
router.delete("/:id", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const returnRequest = await prisma.returnRequest.findFirst({
      where: { id, userId, status: "PENDING" },
    });

    if (!returnRequest) {
      return res.status(404).json({ error: "Return request not found or cannot be cancelled" });
    }

    await prisma.returnRequest.update({
      where: { id },
      data: { status: "CLOSED" },
    });

    res.json({ message: "Return request cancelled" });
  } catch (error) {
    logger.error("Cancel return error", { error });
    res.status(500).json({ error: "Failed to cancel return request" });
  }
}));

export default router;
