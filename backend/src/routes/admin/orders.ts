import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";
import { sendShippingNotification } from "../../lib/email";
import { refundFlutterwaveTransaction } from "../../services/flutterwave";

const router = Router();

router.use(authenticate, requireAdmin);

// GET /api/admin/orders
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const {
      search,
      status,
      paymentStatus,
      dateFrom,
      dateTo,
      sort = "createdAt",
      order = "desc",
      page = "1",
      limit = "20",
    } = req.query;

    const take = Math.min(parseInt(limit as string) || 20, 100);
    const skip = (Math.max(parseInt(page as string) || 1, 1) - 1) * take;

    const where: any = {};

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { customerEmail: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom as string);
      if (dateTo) where.createdAt.lte = new Date(dateTo as string);
    }

    const orderBy: any = {};
    orderBy[sort as string] = order;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy,
        take,
        skip,
        include: {
          items: { select: { quantity: true } },
          payments: { select: { method: true, status: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return res.json({
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        customerEmail: o.customerEmail,
        totalAmount: o.totalAmount,
        currency: o.currency,
        status: o.status,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.payments[0]?.method,
        itemCount: o.items.reduce((sum, item) => sum + item.quantity, 0),
        discreet: o.discreet,
        createdAt: o.createdAt,
      })),
      pagination: {
        total,
        page: Math.floor(skip / take) + 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error("Admin get orders error:", error);
    return res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// GET /api/admin/orders/:id
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, slug: true, images: { take: 1 } } },
          },
        },
        payments: true,
        timeline: { orderBy: { createdAt: "desc" } },
        user: { select: { id: true, email: true, name: true } },
        coupon: { select: { code: true, type: true, value: true } },
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    return res.json(order);
  } catch (error) {
    console.error("Admin get order error:", error);
    return res.status(500).json({ error: "Failed to fetch order" });
  }
});

// PUT /api/admin/orders/:id/status
router.put("/:id/status", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, note, trackingNumber } = z
      .object({
        status: z.enum([
          "PENDING",
          "CONFIRMED",
          "PROCESSING",
          "SHIPPED",
          "DELIVERED",
          "CANCELLED",
          "REFUNDED",
        ]),
        note: z.string().optional(),
        trackingNumber: z.string().optional(),
      })
      .parse(req.body);

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Update order
    const updateData: any = { status };
    if (trackingNumber) {
      updateData.trackingNumber = trackingNumber;
    }

    await prisma.$transaction([
      prisma.order.update({
        where: { id },
        data: updateData,
      }),
      prisma.orderEvent.create({
        data: {
          orderId: id,
          status,
          note: note || `Order status changed to ${status}`,
        },
      }),
    ]);

    // Send shipping notification if shipped
    if (status === "SHIPPED") {
      const updatedOrder = await prisma.order.findUnique({
        where: { id },
        include: { items: true },
      });
      if (updatedOrder) {
        sendShippingNotification(updatedOrder);
      }
    }

    // Restore inventory if cancelled
    if (status === "CANCELLED" && order.status !== "CANCELLED") {
      for (const item of order.items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }

    return res.json({ message: "Order status updated" });
  } catch (error) {
    console.error("Admin update order status error:", error);
    return res.status(500).json({ error: "Failed to update order status" });
  }
});

// POST /api/admin/orders/:id/refund
router.post("/:id/refund", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { amount, reason } = z
      .object({
        amount: z.number().positive().optional(),
        reason: z.string().optional(),
      })
      .parse(req.body);

    const order = await prisma.order.findUnique({
      where: { id },
      include: { payments: true, items: true },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const refundAmount = amount || Number(order.totalAmount);

    // In production, call Flutterwave refund API here
    // For now, just update the status

    await prisma.$transaction([
      prisma.order.update({
        where: { id },
        data: { status: "REFUNDED", paymentStatus: "REFUNDED" },
      }),
      prisma.payment.updateMany({
        where: { orderId: id },
        data: { status: "REFUNDED" },
      }),
      prisma.orderEvent.create({
        data: {
          orderId: id,
          status: "REFUNDED",
          note: `Refund of KES ${refundAmount} processed. ${reason || ""}`,
        },
      }),
    ]);

    // Restore inventory
    for (const item of order.items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }

    return res.json({ message: "Refund processed", amount: refundAmount });
  } catch (error) {
    console.error("Admin refund order error:", error);
    return res.status(500).json({ error: "Failed to process refund" });
  }
});

// POST /api/admin/orders/:id/note
router.post("/:id/note", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { note } = z.object({ note: z.string() }).parse(req.body);

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    await prisma.orderEvent.create({
      data: {
        orderId: id,
        status: "NOTE",
        note,
      },
    });

    return res.json({ message: "Note added" });
  } catch (error) {
    console.error("Admin add note error:", error);
    return res.status(500).json({ error: "Failed to add note" });
  }
});

// POST /api/admin/orders/:id/refund
router.post("/:id/refund", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { amount, reason } = z.object({
      amount: z.number().positive().optional(),
      reason: z.string().optional(),
    }).parse(req.body);

    const order = await prisma.order.findUnique({
      where: { id },
      include: { payments: true },
    });

    if (!order) return res.status(404).json({ error: "Order not found" });
    const payment = order.payments?.[0];
    if (!payment) return res.status(400).json({ error: "No payment record for this order" });
    if (payment.status !== "SUCCESSFUL") {
      return res.status(400).json({ error: "Only paid orders can be refunded" });
    }

    // Initiate refund via Flutterwave
    const refundResult = await refundFlutterwaveTransaction(
      payment.flwTxId!,
      amount,
      reason
    );

    // Update order and payment status
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: "REFUNDED" },
      }),
      prisma.order.update({
        where: { id },
        data: { status: "REFUNDED", paymentStatus: "REFUNDED" },
      }),
      prisma.orderEvent.create({
        data: {
          orderId: id,
          status: "REFUNDED",
          note: reason || "Refund processed by admin",
        },
      }),
    ]);

    // Log admin activity
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: "REFUND_ORDER",
        entityType: "Order",
        entityId: id,
        description: `Refunded order ${id}${reason ? ": " + reason : ""}`,
        metadata: { amount, reason, flutterwaveResponse: refundResult },
        ipAddress: req.ip,
      },
    }).catch(() => {});

    return res.json({ message: "Refund processed successfully", data: refundResult });
  } catch (error: any) {
    console.error("Admin refund error:", error);
    return res.status(500).json({ error: error.message || "Refund failed" });
  }
});

export default router;
