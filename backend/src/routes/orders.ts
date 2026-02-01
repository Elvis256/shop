import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

// GET /api/orders/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: { product: true },
        },
        payments: {
          select: {
            id: true,
            method: true,
            status: true,
            amount: true,
            currency: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    return res.json({
      id: order.id,
      status: order.status,
      totalAmount: order.totalAmount,
      currency: order.currency,
      discreet: order.discreet,
      items: order.items.map((item) => ({
        productId: item.productId,
        productName: item.product.name,
        quantity: item.quantity,
        price: item.price,
      })),
      payments: order.payments,
      createdAt: order.createdAt,
    });
  } catch (error) {
    console.error("Get order error:", error);
    return res.status(500).json({ error: "Failed to fetch order" });
  }
});

// GET /api/orders (list orders for user - simplified without auth)
router.get("/", async (req: Request, res: Response) => {
  try {
    const { email } = req.query;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email required" });
    }

    const orders = await prisma.order.findMany({
      where: { customerEmail: email },
      include: {
        payments: {
          select: { status: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json(
      orders.map((order) => ({
        id: order.id,
        status: order.status,
        totalAmount: order.totalAmount,
        currency: order.currency,
        paymentStatus: order.payments[0]?.status || "PENDING",
        createdAt: order.createdAt,
      }))
    );
  } catch (error) {
    console.error("List orders error:", error);
    return res.status(500).json({ error: "Failed to fetch orders" });
  }
});

export default router;
