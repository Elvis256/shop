import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest, optionalAuth } from "../middleware/auth";
import { sendCancelledNotification } from "../lib/email";

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
              select: { name: true, slug: true, images: { take: 1, orderBy: { position: "asc" } } },
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

    // Parse shippingAddress if stored as JSON string
    let shippingAddress: any = order.shippingAddress;
    if (typeof shippingAddress === "string") {
      try { shippingAddress = JSON.parse(shippingAddress); } catch { /* keep as-is */ }
    }

    const paymentMethodLabels: Record<string, string> = {
      CARD: "Credit/Debit Card",
      MOBILE_MONEY: "Mobile Money",
      PAYPAL: "PayPal",
      COD: "Cash on Delivery",
    };

    const rawMethod = order.payments[0]?.method;

    return res.json({
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: rawMethod ? (paymentMethodLabels[rawMethod] || rawMethod) : null,
      paymentMethodCode: rawMethod || null,
      customerName: order.customerName,
      shippingAddress,
      trackingNumber: order.trackingNumber,
      discreet: order.discreet,
      items: order.items.map((item) => ({
        name: item.name,
        productSlug: item.product.slug,
        quantity: item.quantity,
        price: item.price,
        imageUrl: item.product.images?.[0]?.url || null,
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
          include: {
            product: {
              select: { name: true, slug: true, images: { take: 1, orderBy: { position: "asc" } } },
            },
          },
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

    // Parse shippingAddress if stored as JSON string
    let shippingAddress = order.shippingAddress;
    if (typeof shippingAddress === "string") {
      try { shippingAddress = JSON.parse(shippingAddress); } catch { /* keep as-is */ }
    }

    return res.json({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount,
      subtotal: order.subtotal,
      shippingCost: order.shippingCost,
      discount: order.discount,
      currency: order.currency,
      discreet: order.discreet,
      trackingNumber: order.trackingNumber,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      shippingAddress,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.name || item.product.name,
        productSlug: item.product.slug,
        quantity: item.quantity,
        price: item.price,
        imageUrl: item.product.images?.[0]?.url || null,
      })),
      payments: order.payments,
      events: order.timeline.map((e) => ({
        id: e.id,
        type: e.status,
        message: e.note || `Status: ${e.status}`,
        createdAt: e.createdAt,
      })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
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

// POST /api/orders/:id/cancel - Customer cancels their own order
router.post("/:id/cancel", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Only allow cancellation of PENDING or CONFIRMED orders
    if (!["PENDING", "CONFIRMED"].includes(order.status)) {
      return res.status(400).json({
        error: `Cannot cancel order with status "${order.status}". Only pending or confirmed orders can be cancelled.`,
      });
    }

    await prisma.$transaction(async (tx) => {
      // Update order status
      await tx.order.update({
        where: { id },
        data: { status: "CANCELLED", paymentStatus: order.paymentStatus === "SUCCESSFUL" ? "REFUNDED" : "FAILED" },
      });

      // Update payment status
      await tx.payment.updateMany({
        where: { orderId: id },
        data: { status: order.paymentStatus === "SUCCESSFUL" ? "REFUNDED" : "FAILED" },
      });

      // Add timeline event
      await tx.orderEvent.create({
        data: {
          orderId: id,
          status: "CANCELLED",
          note: "Order cancelled by customer",
        },
      });

      // Restore stock
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      // Release stock reservations
      const reservations = await tx.stockReservation.findMany({
        where: { orderId: id, released: false },
      });
      for (const reservation of reservations) {
        await tx.product.update({
          where: { id: reservation.productId },
          data: { reservedStock: { decrement: reservation.quantity } },
        });
        await tx.stockReservation.update({
          where: { id: reservation.id },
          data: { released: true },
        });
      }
    });

    // Send cancellation email
    sendCancelledNotification(order, "Cancelled by customer").catch(console.error);

    return res.json({ message: "Order cancelled successfully" });
  } catch (error) {
    console.error("Cancel order error:", error);
    return res.status(500).json({ error: "Failed to cancel order" });
  }
});

export default router;
