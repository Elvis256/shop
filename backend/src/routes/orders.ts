import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest, optionalAuth } from "../middleware/auth";

const router = Router();

// GET /api/orders/track/:orderNumber - Public order tracking
router.get("/track/:orderNumber", async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;

    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        items: {
          include: { 
            product: {
              select: { name: true, slug: true },
            }
          },
        },
        timeline: {
          orderBy: { createdAt: "desc" },
        },
        payments: {
          select: {
            method: true,
            status: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Build status timeline with estimated dates
    const statusSteps = [
      { status: "PENDING", label: "Order Placed", description: "Your order has been received" },
      { status: "CONFIRMED", label: "Confirmed", description: "Payment verified, preparing your order" },
      { status: "PROCESSING", label: "Processing", description: "Your order is being prepared" },
      { status: "SHIPPED", label: "Shipped", description: "Your order is on its way" },
      { status: "DELIVERED", label: "Delivered", description: "Order delivered successfully" },
    ];

    const currentStatusIndex = statusSteps.findIndex((s) => s.status === order.status);

    return res.json({
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.payments[0]?.method,
      customerName: order.customerName,
      shippingAddress: order.shippingAddress,
      trackingNumber: order.trackingNumber,
      discreet: order.discreet,
      items: order.items.map((item) => ({
        name: item.name,
        productSlug: item.product.slug,
        quantity: item.quantity,
        price: item.price,
      })),
      subtotal: order.subtotal,
      shipping: order.shippingCost,
      discount: order.discount,
      total: order.totalAmount,
      currency: order.currency,
      timeline: order.timeline.map((event) => ({
        status: event.status,
        note: event.note,
        timestamp: event.createdAt,
      })),
      statusSteps: statusSteps.map((step, index) => ({
        ...step,
        completed: index <= currentStatusIndex,
        current: index === currentStatusIndex,
      })),
      createdAt: order.createdAt,
    });
  } catch (error) {
    console.error("Track order error:", error);
    return res.status(500).json({ error: "Failed to fetch order" });
  }
});

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
        timeline: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    return res.json({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount,
      currency: order.currency,
      discreet: order.discreet,
      trackingNumber: order.trackingNumber,
      shippingAddress: order.shippingAddress,
      items: order.items.map((item) => ({
        productId: item.productId,
        productName: item.product.name,
        productSlug: item.product.slug,
        quantity: item.quantity,
        price: item.price,
      })),
      payments: order.payments,
      timeline: order.timeline,
      createdAt: order.createdAt,
    });
  } catch (error) {
    console.error("Get order error:", error);
    return res.status(500).json({ error: "Failed to fetch order" });
  }
});

// GET /api/orders (list orders for authenticated user)
router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userEmail = req.user!.email;

    const orders = await prisma.order.findMany({
      where: { customerEmail: userEmail },
      include: {
        payments: {
          select: { status: true },
        },
        items: {
          select: { quantity: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json(
      orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: order.totalAmount,
        currency: order.currency,
        paymentStatus: order.payments[0]?.status || "PENDING",
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
        createdAt: order.createdAt,
      }))
    );
  } catch (error) {
    console.error("List orders error:", error);
    return res.status(500).json({ error: "Failed to fetch orders" });
  }
});

export default router;
