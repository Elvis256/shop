import { Router, Response } from "express";
import { PrismaClient, ReturnReason, ReturnStatus } from "@prisma/client";
import { z } from "zod";
import { authenticate, optionalAuth, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

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
router.post("/", authenticate, async (req: AuthRequest, res: Response) => {
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
    console.error("Create return error:", error);
    res.status(500).json({ error: "Failed to create return request" });
  }
});

// Get user's return requests
router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
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
    console.error("Get returns error:", error);
    res.status(500).json({ error: "Failed to fetch return requests" });
  }
});

// Get single return request
router.get("/:id", authenticate, async (req: AuthRequest, res: Response) => {
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
    console.error("Get return error:", error);
    res.status(500).json({ error: "Failed to fetch return request" });
  }
});

// Cancel return request (only if pending)
router.delete("/:id", authenticate, async (req: AuthRequest, res: Response) => {
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
    console.error("Cancel return error:", error);
    res.status(500).json({ error: "Failed to cancel return request" });
  }
});

export default router;
