import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";
import { sendShippingNotification, sendProcessingNotification, sendDeliveredNotification, sendCancelledNotification } from "../../lib/email";
import { refundFlutterwaveTransaction } from "../../services/flutterwave";
import { sendOrderConfirmationWhatsApp, sendShippingUpdateWhatsApp, sendDeliveryConfirmationWhatsApp } from "../../services/whatsapp";
import { sendOrderConfirmationSMS, sendShippingUpdateSMS } from "../../services/sms";
import { logger } from "../../lib/logger";
import { asyncHandler } from "../../middleware/errorHandler";

const router = Router();

router.use(authenticate, requireAdmin);

// GET /api/admin/orders
router.get("/", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const {
      search,
      status,
      paymentStatus,
      dateFrom,
      dateTo,
      isGift,
      sellerId,
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

    if (isGift === "true") {
      where.isGift = true;
    }

    if (sellerId) {
      where.items = { some: { sellerId: sellerId as string } };
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
        isGift: o.isGift,
        giftAddressSet: o.giftAddressSet,
        giftMessage: o.giftMessage,
        giftRecipientPhone: o.giftRecipientPhone,
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
    logger.error("Admin get orders error", { error });
    return res.status(500).json({ error: "Failed to fetch orders" });
  }
}));

// GET /api/admin/orders/:id
router.get("/:id", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, slug: true, images: { take: 1, orderBy: { position: "asc" } } } },
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

    // Parse shippingAddress if stored as JSON string
    let shippingAddress: any = order.shippingAddress;
    if (typeof shippingAddress === "string") {
      try { shippingAddress = JSON.parse(shippingAddress); } catch { /* keep as-is */ }
    }

    return res.json({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.payments?.[0]?.method || null,
      totalAmount: order.totalAmount,
      subtotal: order.subtotal,
      discount: order.discount || 0,
      tax: 0,
      shippingCost: order.shippingCost,
      currency: order.currency,
      discreet: order.discreet,
      trackingNumber: order.trackingNumber,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      customer: order.user
        ? { id: order.user.id, name: order.user.name, email: order.user.email, phone: null }
        : { id: null, name: order.customerName, email: order.customerEmail, phone: null },
      shippingAddress: typeof shippingAddress === "object" && shippingAddress !== null
        ? {
            name: shippingAddress.name || order.customerName,
            phone: shippingAddress.phone || "",
            street: shippingAddress.address || shippingAddress.street || "",
            city: shippingAddress.city || "",
            county: shippingAddress.county || shippingAddress.postalCode || null,
            country: shippingAddress.country || "Uganda",
          }
        : null,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.name || item.product.name,
        price: item.price,
        quantity: item.quantity,
        imageUrl: item.product.images?.[0]?.url || null,
      })),
      payments: order.payments,
      timeline: order.timeline.map((e) => ({
        id: e.id,
        status: e.status,
        note: e.note,
        createdAt: e.createdAt,
      })),
      coupon: order.coupon,
    });
  } catch (error) {
    logger.error("Admin get order error", { error });
    return res.status(500).json({ error: "Failed to fetch order" });
  }
}));

// PUT /api/admin/orders/:id/status
router.put("/:id/status", asyncHandler(async (req: AuthRequest, res: Response) => {
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

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: updateData,
      });
      await tx.orderEvent.create({
        data: {
          orderId: id,
          status,
          note: note || `Order status changed to ${status}`,
        },
      });

      // Create escrow when order is CONFIRMED (payment verified)
      if (status === "CONFIRMED" && order.paymentStatus === "SUCCESSFUL") {
        const existingEscrow = await tx.escrowTransaction.findUnique({ where: { orderId: id } });
        if (!existingEscrow) {
          await tx.escrowTransaction.create({
            data: {
              orderId: id,
              amount: order.totalAmount,
              currency: order.currency,
              status: "HELD",
              releaseDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days after delivery
            },
          });
        }
      }

      // Auto-set escrow release date when delivered
      if (status === "DELIVERED") {
        const escrow = await tx.escrowTransaction.findUnique({ where: { orderId: id } });
        if (escrow && escrow.status === "HELD") {
          await tx.escrowTransaction.update({
            where: { id: escrow.id },
            data: { releaseDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
          });
        }
      }
    });

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

    // Send processing notification
    if (status === "PROCESSING") {
      sendProcessingNotification(order).catch(err => logger.error('send_processing_notification_failed', { error: err }));
    }

    // Send delivered notification
    if (status === "DELIVERED") {
      sendDeliveredNotification(order).catch(err => logger.error('send_delivered_notification_failed', { error: err }));
    }

    // WhatsApp & SMS notifications (fire-and-forget)
    if (order.customerPhone) {
      if (status === "CONFIRMED") {
        sendOrderConfirmationWhatsApp(order.customerPhone, order.orderNumber, order.totalAmount.toString()).catch(() => {});
        sendOrderConfirmationSMS(order.customerPhone, order.orderNumber, order.totalAmount.toString()).catch(() => {});
      }
      if (status === "SHIPPED") {
        sendShippingUpdateWhatsApp(order.customerPhone, order.orderNumber, order.trackingNumber || undefined).catch(() => {});
        sendShippingUpdateSMS(order.customerPhone, order.orderNumber).catch(() => {});
      }
      if (status === "DELIVERED") {
        sendDeliveryConfirmationWhatsApp(order.customerPhone, order.orderNumber).catch(() => {});
      }
    }

    // Restore inventory if cancelled
    if (status === "CANCELLED" && order.status !== "CANCELLED") {
      await prisma.$transaction(async (tx) => {
        // Set payment status to FAILED for non-paid orders
        if (order.paymentStatus !== "SUCCESSFUL") {
          await tx.order.update({
            where: { id },
            data: { paymentStatus: "FAILED" },
          });
          await tx.payment.updateMany({
            where: { orderId: id },
            data: { status: "FAILED" },
          });
        }
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
      sendCancelledNotification(order, note).catch(err => logger.error('send_cancelled_notification_failed', { error: err }));
    }

    return res.json({ message: "Order status updated" });
  } catch (error) {
    logger.error("Admin update order status error", { error });
    return res.status(500).json({ error: "Failed to update order status" });
  }
}));

// POST /api/admin/orders/:id/mark-paid - Mark COD order as paid
router.post("/:id/mark-paid", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { payments: true },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.paymentStatus === "SUCCESSFUL") {
      return res.status(400).json({ error: "Payment is already marked as successful" });
    }

    await prisma.$transaction([
      prisma.order.update({
        where: { id },
        data: { paymentStatus: "SUCCESSFUL" },
      }),
      prisma.payment.updateMany({
        where: { orderId: id },
        data: { status: "SUCCESSFUL" },
      }),
      prisma.orderEvent.create({
        data: {
          orderId: id,
          status: "PAYMENT_RECEIVED",
          note: "Payment received and confirmed by admin",
        },
      }),
    ]);

    return res.json({ message: "Payment marked as successful" });
  } catch (error) {
    logger.error("Admin mark paid error", { error });
    return res.status(500).json({ error: "Failed to mark payment" });
  }
}));

// POST /api/admin/orders/:id/note
router.post("/:id/note", asyncHandler(async (req: AuthRequest, res: Response) => {
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
    logger.error("Admin add note error", { error });
    return res.status(500).json({ error: "Failed to add note" });
  }
}));

// POST /api/admin/orders/:id/refund
router.post("/:id/refund", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { amount, reason } = z.object({
      amount: z.number().positive().optional(),
      reason: z.string().optional(),
    }).parse(req.body);

    const order = await prisma.order.findUnique({
      where: { id },
      include: { payments: true, items: true },
    });

    if (!order) return res.status(404).json({ error: "Order not found" });
    const payment = order.payments?.[0];
    if (!payment) return res.status(400).json({ error: "No payment record for this order" });
    if (payment.status !== "SUCCESSFUL") {
      return res.status(400).json({ error: "Only paid orders can be refunded" });
    }

    const refundAmount = amount || Number(order.totalAmount);
    if (refundAmount > Number(order.totalAmount)) {
      return res.status(400).json({ error: "Refund amount cannot exceed order total" });
    }

    // Initiate refund via Flutterwave
    const refundResult = await refundFlutterwaveTransaction(
      payment.flwTxId!,
      amount,
      reason
    );

    // Update order/payment status and restore inventory atomically
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "REFUNDED" },
      });
      await tx.order.update({
        where: { id },
        data: { status: "REFUNDED", paymentStatus: "REFUNDED" },
      });
      await tx.orderEvent.create({
        data: {
          orderId: id,
          status: "REFUNDED",
          note: reason || "Refund processed by admin",
        },
      });

      // Restore inventory inside transaction
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
    });

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
    logger.error("Admin refund error", { error });
    return res.status(500).json({ error: "Refund failed" });
  }
}));

export default router;
