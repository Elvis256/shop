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
      include: {
        items: true,
        timeline: {
          where: { status: "DELIVERED" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found or not eligible for return" });
    }

    // Enforce 7-day return window from delivery date (fallback to order.createdAt to prevent admin updatedAt resets)
    const RETURN_WINDOW_DAYS = 7;
    if (order.status === "DELIVERED") {
      const deliveredAt = order.timeline[0]?.createdAt || order.createdAt;
      const daysSinceDelivery = (Date.now() - deliveredAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDelivery > RETURN_WINDOW_DAYS) {
        return res.status(400).json({
          error: `Return window has expired. Returns must be requested within ${RETURN_WINDOW_DAYS} days of delivery.`,
        });
      }
    }

    // Validate return item quantities against actual order items and past returns
    for (const returnItem of data.items) {
      const orderItem = order.items.find(oi => oi.id === returnItem.orderItemId);
      if (!orderItem) {
        return res.status(400).json({ error: `Order item ${returnItem.orderItemId} not found in this order` });
      }

      // Check how many items have already been returned and approved/pending
      const alreadyReturned = await prisma.returnItem.aggregate({
        where: {
          orderItemId: returnItem.orderItemId,
          returnRequest: {
            status: { notIn: ["REJECTED", "CLOSED"] },
          },
        },
        _sum: {
          quantity: true,
        },
      });

      const returnedCount = alreadyReturned._sum.quantity || 0;
      const remainingReturnable = orderItem.quantity - returnedCount;

      if (returnItem.quantity > remainingReturnable) {
        return res.status(400).json({
          error: `Cannot return ${returnItem.quantity} of "${orderItem.name}" — already returned/pending: ${returnedCount}, remaining returnable: ${remainingReturnable}`,
        });
      }
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
router.get("/admin/all", authenticate, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { search, status, page = "1", limit = "20" } = req.query;
    const take = Math.min(parseInt(limit as string) || 20, 100);
    const skip = (Math.max(parseInt(page as string) || 1, 1) - 1) * take;

    const where: any = {};
    if (status && status !== "All") where.status = status;
    if (search) {
      where.OR = [
        { order: { orderNumber: { contains: search as string, mode: "insensitive" } } },
        { order: { customerName: { contains: search as string, mode: "insensitive" } } },
        { order: { customerEmail: { contains: search as string, mode: "insensitive" } } },
      ];
    }

    const [returns, total] = await Promise.all([
      prisma.returnRequest.findMany({
        where,
        include: {
          order: { select: { orderNumber: true, totalAmount: true, customerName: true, customerEmail: true } },
          user: { select: { name: true, email: true } },
          items: true,
        },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.returnRequest.count({ where }),
    ]);

    res.json({
      returns,
      pagination: {
        total,
        page: Math.floor(skip / take) + 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}));

// PUT /api/returns/:id/status — Update return status (admin)
router.put("/:id/status", authenticate, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { status, adminNotes, refundAmount, refundMethod } = req.body;

    const exists = await prisma.returnRequest.findUnique({
      where: { id: req.params.id },
    });
    if (!exists) {
      return res.status(404).json({ error: "Return request not found" });
    }

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
