import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";
import { refundFlutterwaveTransaction } from "../../services/flutterwave";
import { confirmPaidOrder, releaseOrderStock } from "../../services/orderConfirmation";
import { sendWhatsApp } from "../../services/whatsapp";
import { sendSMS } from "../../services/sms";
import { enqueueNotification } from "../../services/notificationDispatcher";
import { logger } from "../../lib/logger";
import { asyncHandler } from "../../middleware/errorHandler";
import crypto from "crypto";
import { awardPurchasePoints } from "../loyalty";
import { approveAffiliateConversions } from "../../utils/affiliateHelper";
import { parseShippingAddress } from "../../utils/shippingAddress";

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

    const allowedSortFields = ["createdAt", "totalAmount", "status", "paymentStatus", "orderNumber"];
    const sortField = allowedSortFields.includes(sort as string) ? (sort as string) : "createdAt";
    const orderBy: any = {};
    orderBy[sortField] = order;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy,
        take,
        skip,
        include: {
          items: { select: { quantity: true } },
          payments: { select: { method: true, status: true } },
          stockReservations: {
            where: { released: false },
            select: { expiresAt: true },
          },
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
        isSplitPayment: o.isSplitPayment,
        splitPartnerPaid: o.splitPartnerPaid,
        splitPaidAmount: o.splitPaidAmount,
        expiresAt: o.stockReservations?.[0]?.expiresAt || null,
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

// GET /api/admin/orders/export/csv — CSV export of orders
router.get("/export/csv", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { status, paymentStatus, dateFrom, dateTo, sellerId } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom as string);
      if (dateTo) where.createdAt.lte = new Date(dateTo as string);
    }
    if (sellerId) where.items = { some: { sellerId: sellerId as string } };

    const MAX_CSV_EXPORT = 1000;
    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: MAX_CSV_EXPORT,
      include: {
        items: { select: { name: true, quantity: true, price: true, sellerId: true } },
        payments: { select: { method: true, status: true } },
      },
    });

    if (orders.length === MAX_CSV_EXPORT) {
      res.setHeader("X-Export-Truncated", "true");
      res.setHeader("X-Export-Limit", String(MAX_CSV_EXPORT));
    }

    const escape = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = "Order Number,Date,Customer Name,Email,Phone,Status,Payment Status,Payment Method,Items,Subtotal,Shipping,Tax,Total,Currency,Delivery Method,City";
    const rows = orders.map((o) => [
      escape(o.orderNumber),
      o.createdAt.toISOString(),
      escape(o.customerName),
      escape(o.customerEmail),
      escape(o.customerPhone || ""),
      o.status,
      o.paymentStatus,
      o.payments[0]?.method || "",
      o.items.map((i) => `${i.name} x${i.quantity}`).join("; "),
      Number(o.totalAmount) - Number(o.shippingCost || 0) - Number(o.tax || 0),
      Number(o.shippingCost || 0),
      Number(o.tax || 0),
      Number(o.totalAmount),
      o.currency,
      o.deliveryMethod || "home",
      escape((o.shippingAddress || "").split("\n")[0]),
    ].join(","));

    const csv = [header, ...rows].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="orders-${new Date().toISOString().split("T")[0]}.csv"`);
    return res.send(csv);
  } catch (error) {
    logger.error("Admin export orders error", { error });
    return res.status(500).json({ error: "Failed to export orders" });
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
        stockReservations: {
          where: { released: false },
          select: { expiresAt: true },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const shippingAddress = parseShippingAddress(order.shippingAddress);

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
      isSplitPayment: order.isSplitPayment,
      splitShowItems: order.splitShowItems,
      splitPaidAmount: order.splitPaidAmount,
      splitPartnerPhone: order.splitPartnerPhone,
      splitPartnerPaid: order.splitPartnerPaid,
      expiresAt: order.stockReservations?.[0]?.expiresAt || null,
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
    const { status, note, trackingNumber, force } = z
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
        // FIX M1: force flag allows admin to explicitly override payment checks
        force: z.boolean().optional().default(false),
      })
      .parse(req.body);

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true, coupon: true },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // FIX M1: Guard PENDING→CONFIRMED without payment verification
    if (status === "CONFIRMED" && order.paymentStatus !== "SUCCESSFUL" && !force) {
      return res.status(400).json({
        error: `Cannot confirm an unpaid order (paymentStatus: ${order.paymentStatus}). Pass force=true to override.`,
        requiresForce: true,
      });
    }

    // Validate state transition — prevent invalid status changes
    const validTransitions: Record<string, string[]> = {
      PENDING:    ["CONFIRMED", "PROCESSING", "CANCELLED"],
      CONFIRMED:  ["PROCESSING", "SHIPPED", "CANCELLED"],
      PROCESSING: ["SHIPPED", "CANCELLED"],
      SHIPPED:    ["DELIVERED", "CANCELLED"],
      DELIVERED:  ["REFUNDED"],
      CANCELLED:  [],  // terminal state
      REFUNDED:   [],  // terminal state
    };

    const allowed = validTransitions[order.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: `Cannot change status from ${order.status} to ${status}`,
        allowedTransitions: allowed,
      });
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

      // Refund store credit if order is CANCELLED or REFUNDED
      if (status === "CANCELLED" || status === "REFUNDED") {
        const { refundStoreCreditForOrder } = await import("../../utils/storeCredit");
        await refundStoreCreditForOrder(tx, id);
      }

      // FIX C1: Decrement coupon usedCount when order is cancelled
      if ((status === "CANCELLED") && order.couponId) {
        await tx.coupon.update({
          where: { id: order.couponId },
          data: { usedCount: { decrement: 1 } },
        });
      }

      // FIX C2: Restore gift card balance when order is cancelled
      if (status === "CANCELLED") {
        const gcRedemption = await tx.giftCardRedemption.findFirst({
          where: { orderId: id },
        });
        if (gcRedemption) {
          await tx.giftCard.update({
            where: { id: gcRedemption.giftCardId },
            data: { currentValue: { increment: Number(gcRedemption.amount) }, isActive: true },
          });
          await tx.giftCardRedemption.delete({ where: { id: gcRedemption.id } });
          logger.info("gift_card_restored_on_admin_cancel", { orderId: id, giftCardId: gcRedemption.giftCardId, amount: gcRedemption.amount });
        }
      }

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
        await approveAffiliateConversions(id, tx);
      }
    });

    // Dispatch notifications via centralized dispatcher
    const eventMap: Record<string, string> = {
      PROCESSING: "ORDER_PROCESSING",
      SHIPPED: "ORDER_SHIPPED",
      DELIVERED: "ORDER_DELIVERED",
      CONFIRMED: "ORDER_RECEIVED",
    };
    const notifEvent = eventMap[status];
    if (notifEvent) {
      const updatedOrder = status === "SHIPPED"
        ? await prisma.order.findUnique({ where: { id }, include: { items: true } })
        : order;
      if (updatedOrder) {
        enqueueNotification({
          event: notifEvent as any,
          recipientEmail: updatedOrder.customerEmail || undefined,
          recipientPhone: updatedOrder.customerPhone || undefined,
          recipientUserId: updatedOrder.userId || undefined,
          orderId: id,
          data: {
            customerName: updatedOrder.customerName,
            orderNumber: updatedOrder.orderNumber,
            orderId: id,
            total: Number(updatedOrder.totalAmount),
            currency: updatedOrder.currency || "UGX",
            trackingNumber: (updatedOrder as any).trackingNumber || trackingNumber,
            estimatedDelivery: "2-3 business days",
          },
        }).catch((err) => logger.error("Notification dispatch failed", { error: err }));
      }
    }

    // Auto-generate delivery OTP for COD (unpaid) orders when shipped
    if (status === "SHIPPED" && order.customerPhone && order.paymentStatus === "PENDING") {
      const otp = crypto.randomInt(100000, 999999).toString();
      const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      prisma.order.update({
        where: { id },
        data: { deliveryOtp: otp, deliveryOtpExpiry: expiry },
      }).then(() => {
        const msg = `Your delivery verification code for order ${order.orderNumber} is: ${otp}. Share this with the delivery agent upon receipt. Valid for 24 hours.`;
        sendWhatsApp({ to: order.customerPhone!, text: msg }).catch(() => {});
        sendSMS(order.customerPhone!, msg).catch(() => {});
      }).catch(err => logger.error("Auto OTP generation failed", { error: err }));
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
        // Only restore stock if payment was successful (stock was actually decremented).
        // For unpaid orders, stock was only reserved, not decremented — reservations
        // are released below.
        if (order.paymentStatus === "SUCCESSFUL") {
          for (const item of order.items) {
            if (item.variantId) {
              await tx.productVariant.update({
                where: { id: item.variantId },
                data: { stock: { increment: item.quantity } },
              });
            } else {
              await tx.product.update({
                where: { id: item.productId },
                data: { stock: { increment: item.quantity } },
              });
            }
          }
        }
        // Release stock reservations (handles variants)
        await releaseOrderStock(tx, id);
      });
      enqueueNotification({
        event: "ORDER_CANCELLED",
        recipientEmail: order.customerEmail || undefined,
        recipientPhone: order.customerPhone || undefined,
        recipientUserId: order.userId || undefined,
        orderId: id,
        data: {
          customerName: order.customerName,
          orderNumber: order.orderNumber,
          orderId: id,
          total: Number(order.totalAmount),
          currency: order.currency || "UGX",
          reason: note,
        },
      }).catch(err => logger.error('notification_dispatch_cancelled_failed', { error: err }));
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

    await prisma.$transaction(async (tx) => {
      await tx.payment.updateMany({
        where: { orderId: id },
        data: { status: "SUCCESSFUL" },
      });

      await confirmPaidOrder(tx, id);

      await tx.orderEvent.create({
        data: {
          orderId: id,
          status: "PAYMENT_RECEIVED",
          note: "Payment received and confirmed by admin",
        },
      });
    });


    // Award loyalty points to the customer
    if (order.userId) {
      awardPurchasePoints(order.userId, Number(order.totalAmount), order.id)
        .catch(err => logger.error("Failed to award purchase points on mark-paid", { error: err }));
    }

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

    // Route refund to correct provider
    let refundResult: any = null;
    if (payment.provider === "flutterwave" && payment.flwTxId) {
      refundResult = await refundFlutterwaveTransaction(
        payment.flwTxId,
        amount,
        reason
      );
    } else if (payment.provider === "paypal") {
      // PayPal refunds must be processed manually through PayPal dashboard
      refundResult = { status: "manual", message: "PayPal refund must be processed through PayPal dashboard" };
    } else if (payment.provider === "cod" || payment.method === "COD") {
      // COD refund is manual — just update the records
      refundResult = { status: "manual", message: "COD refund processed manually" };
    } else {
      return res.status(400).json({ error: `Refund not supported for provider: ${payment.provider}. No transaction ID available.` });
    }

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

      // FIX C3: Only restore inventory on full refunds to prevent phantom inventory.
      // Partial refunds (amount < order total) must not restore stock, because
      // we cannot know which specific items are being returned.
      const isFullRefund = !amount || refundAmount >= Number(order.totalAmount);
      if (isFullRefund) {
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      } else {
        logger.info("partial_refund_stock_not_restored", { orderId: id, refundAmount, orderTotal: Number(order.totalAmount) });
      }
    });

    // Notify customer about refund
    enqueueNotification({
      event: "ORDER_REFUNDED",
      recipientEmail: order.customerEmail || undefined,
      recipientPhone: order.customerPhone || undefined,
      recipientUserId: order.userId || undefined,
      orderId: id,
      data: {
        customerName: order.customerName,
        orderNumber: order.orderNumber,
        orderId: id,
        refundAmount: refundAmount,
        total: Number(order.totalAmount),
        currency: order.currency || "UGX",
        reason,
      },
    }).catch(err => logger.error("Refund notification failed", { error: err }));

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
