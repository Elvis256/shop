import { Router, Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest, optionalAuth } from "../middleware/auth";
import { enqueueNotification } from "../services/notificationDispatcher";
import { Decimal } from "@prisma/client/runtime/library";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";
import { approveAffiliateConversions } from "../utils/affiliateHelper";
import { reserveStock } from "../utils/stockReservation";
import { parseShippingAddress } from "../utils/shippingAddress";
import { releaseOrderStock } from "../services/orderConfirmation";
import redis from "../lib/redis";

const router = Router();

// Redis-backed rate limiter for public order tracking (30 req/min per IP)
// Falls back to in-memory if Redis is unavailable
const trackRateLimitFallback = new Map<string, { count: number; resetAt: number }>();
async function trackRateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = (req.headers["x-forwarded-for"] as string || req.ip || "").split(",")[0].trim();
  const key = `rl:track:${ip}`;

  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60);
    if (count > 30) {
      return res.status(429).json({ error: "Too many requests. Please wait a moment before trying again." });
    }
  } catch {
    // Fallback to in-memory if Redis is unavailable
    const now = Date.now();
    const entry = trackRateLimitFallback.get(ip) || { count: 0, resetAt: now + 60_000 };
    if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + 60_000; }
    entry.count++;
    trackRateLimitFallback.set(ip, entry);
    if (entry.count > 30) {
      return res.status(429).json({ error: "Too many requests. Please wait a moment before trying again." });
    }
  }
  next();
}

// GET /api/orders/track/:orderNumber - Track order (requires email for verification)
router.get("/track/:orderNumber", trackRateLimit, asyncHandler(async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const email = (req.query.email as string || "").toLowerCase().trim();

    if (!email) {
      return res.status(400).json({ error: "Email is required to track an order" });
    }

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

    // Verify email matches the order customer
    if (order.customerEmail?.toLowerCase() !== email) {
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

    const shippingAddress = parseShippingAddress(order.shippingAddress);

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
      customerName: order.customerName?.split(" ")[0] || "Customer",
      trackingNumber: order.trackingNumber,
      discreet: order.discreet,
      items: order.items.map((item) => {
        const isMasked = (order as any).receiptMasked;
        return {
          name: isMasked 
            ? `Discreet Wellness Item (PZ-${(item.productId || item.id).substring(0, 4).toUpperCase()})` 
            : item.name,
          productSlug: isMasked 
            ? `discreet-item-${(item.productId || item.id).substring(0, 4)}` 
            : item.product.slug,
          quantity: item.quantity,
          price: item.price,
          imageUrl: isMasked ? null : (item.product.images?.[0]?.url || null),
        };
      }),
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
    logger.error("Track order error", { error });
    return res.status(500).json({ error: "Failed to fetch order" });
  }
}));

// GET /api/orders/by-ref/:txRef — Resolve a Flutterwave tx_ref to an order summary
// Used by the checkout success page when the customer returns from Flutterwave.
router.get("/by-ref/:txRef", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { txRef } = req.params;
    if (!txRef) {
      return res.status(400).json({ error: "Transaction reference required" });
    }

    // Some tx_refs are stored as flwRef on the Payment record.
    const payment = await prisma.payment.findFirst({
      where: { flwRef: txRef },
      select: { orderId: true },
    });

    let orderId: string | null = payment?.orderId || null;

    // Fallback: parse well-known tx_ref prefixes to extract the order id.
    if (!orderId) {
      if (txRef.startsWith("split-init-") || txRef.startsWith("split-part-")) {
        // format: prefix-{orderId}
        orderId = txRef.split("-").slice(2).join("-");
      } else {
        // Normal checkout uses the order id directly as tx_ref.
        orderId = txRef;
      }
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        currency: true,
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    return res.json(order);
  } catch (error) {
    logger.error("Resolve order by ref error", { error });
    return res.status(500).json({ error: "Failed to resolve order" });
  }
}));

// GET /api/orders/:id/payment-status — Poll payment status (auth + ownership)
// GET /api/orders/:id/payment-status
// FIX C4: Require email/phone verification for guest orders to prevent IDOR via semi-predictable CUIDs.
router.get("/:id/payment-status", optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      select: { paymentStatus: true, status: true, orderNumber: true, userId: true, customerEmail: true, customerPhone: true },
    });
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    const user = req.user;
    const isOwner = user && (order.userId === user.id || order.customerEmail === user.email);
    const isAdmin = user && (user.role === "ADMIN" || user.role === "MANAGER");

    if (!isOwner && !isAdmin) {
      // FIX C4: Guest order — require email or phone verification token
      const verifyEmail = ((req.query.email as string) || "").toLowerCase().trim();
      const verifyPhone = ((req.query.phone as string) || "").replace(/\s+/g, "");
      const emailMatch = verifyEmail && order.customerEmail.toLowerCase() === verifyEmail;
      const phoneMatch = verifyPhone && order.customerPhone &&
        order.customerPhone.replace(/\s+/g, "") === verifyPhone;

      if (!emailMatch && !phoneMatch) {
        // Return 404 rather than 403 to avoid confirming the order exists
        return res.status(404).json({ error: "Order not found" });
      }
    }

    return res.json({
      paymentStatus: order.paymentStatus,
      status: order.status,
      orderNumber: order.orderNumber,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to check status" });
  }
}));

// GET /api/orders/:id — authenticated owners, admins, or verified guests
router.get("/:id", optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
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

    // Verify ownership: user must own the order, be an admin, or pass guest verification
    const user = req.user;
    const isOwner = user && (order.userId === user.id || order.customerEmail === user.email);
    const isAdmin = user && (user.role === "ADMIN" || user.role === "MANAGER");
    let isVerifiedGuest = false;

    if (!isOwner && !isAdmin) {
      const verifyEmail = ((req.query.email as string) || "").toLowerCase().trim();
      const verifyPhone = ((req.query.phone as string) || "").replace(/\s+/g, "");
      const emailMatch = verifyEmail && order.customerEmail.toLowerCase() === verifyEmail;
      const phoneMatch = verifyPhone && order.customerPhone &&
        order.customerPhone.replace(/\s+/g, "") === verifyPhone;

      if (!emailMatch && !phoneMatch) {
        // Return 404 rather than 403 to avoid confirming the order exists
        return res.status(404).json({ error: "Order not found" });
      }
      isVerifiedGuest = true;
    }

    const shippingAddress = parseShippingAddress(order.shippingAddress);

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
      deliveryMethod: (order as any).deliveryMethod || null,
      shippingAddress,
      isSplitPayment: order.isSplitPayment,
      splitPaidAmount: order.splitPaidAmount,
      splitPartnerPhone: order.splitPartnerPhone,
      splitPartnerPaid: order.splitPartnerPaid,
      items: order.items.map((item) => {
        const isMasked = (order as any).receiptMasked;
        return {
          id: item.id,
          productId: item.productId,
          productName: isMasked 
            ? `Discreet Wellness Item (PZ-${(item.productId || item.id).substring(0, 4).toUpperCase()})` 
            : (item.name || item.product.name),
          productSlug: isMasked 
            ? `discreet-item-${(item.productId || item.id).substring(0, 4)}` 
            : item.product.slug,
          quantity: item.quantity,
          price: item.price,
          imageUrl: isMasked ? null : (item.product.images?.[0]?.url || null),
        };
      }),
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
    logger.error("Get order error", { error });
    return res.status(500).json({ error: "Failed to fetch order" });
  }
}));

// GET /api/orders (list orders for authenticated user)
router.get("/", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userEmail = req.user!.email;
    const userId = req.user!.id;

    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { customerEmail: userEmail },
          { userId },
        ],
      },
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
    logger.error("List orders error", { error });
    return res.status(500).json({ error: "Failed to fetch orders" });
  }
}));

// POST /api/orders/:id/reorder - Re-add order items to cart
router.post("/:id/reorder", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Verify ownership
    if (order.userId !== req.user!.id && order.customerEmail !== req.user!.email) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Get or create user's cart
    let cart = await prisma.cart.findUnique({ where: { userId: req.user!.id } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { userId: req.user!.id } });
    }

    // Add each order item to the cart
    for (const item of order.items) {
      await prisma.cartItem.upsert({
        where: { cartId_productId_variantId: { cartId: cart.id, productId: item.productId, variantId: item.variantId || null } },
        update: { quantity: { increment: item.quantity } },
        create: { cartId: cart.id, productId: item.productId, variantId: item.variantId || null, quantity: item.quantity },
      });
    }

    // Return updated cart
    const updatedCart = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                price: true,
                currency: true,
                stock: true,
                images: { take: 1, orderBy: { position: "asc" } },
              },
            },
          },
        },
      },
    });

    return res.json({
      message: "Items added to cart",
      cart: {
        id: updatedCart!.id,
        items: updatedCart!.items.map((ci) => ({
          id: ci.id,
          productId: ci.productId,
          quantity: ci.quantity,
          product: {
            ...ci.product,
            imageUrl: ci.product.images[0]?.url || null,
          },
        })),
      },
    });
  } catch (error) {
    logger.error("Reorder error", { error });
    return res.status(500).json({ error: "Failed to reorder" });
  }
}));

// POST /api/orders/:id/cancel - Customer cancels their own order
router.post("/:id/cancel", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true, coupon: true },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Verify the authenticated user owns this order
    if (order.customerEmail !== req.user!.email && order.userId !== req.user!.id) {
      return res.status(403).json({ error: "You can only cancel your own orders" });
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

      const { refundStoreCreditForOrder } = await import("../utils/storeCredit");
      await refundStoreCreditForOrder(tx, id);

      // FIX C1: Decrement coupon usedCount on cancellation
      if (order.couponId) {
        await tx.coupon.update({
          where: { id: order.couponId },
          data: { usedCount: { decrement: 1 } },
        });
      }

      // FIX C2: Restore gift card balance on cancellation
      const gcRedemption = await tx.giftCardRedemption.findFirst({
        where: { orderId: id },
      });
      if (gcRedemption) {
        const restoredGc = await tx.giftCard.update({
          where: { id: gcRedemption.giftCardId },
          data: { currentValue: { increment: Number(gcRedemption.amount) }, isActive: true },
        });
        await tx.giftCardRedemption.delete({ where: { id: gcRedemption.id } });
        logger.info("gift_card_restored_on_cancel", { orderId: id, giftCardId: gcRedemption.giftCardId, amount: gcRedemption.amount });
      }

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

      // Restore stock only if it was actually decremented (paid orders)
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

    // Send cancellation notifications (email + SMS + WhatsApp + push)
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
        reason: "Cancelled by customer",
      },
    }).catch(err => logger.error('cancel_notification_failed', { error: err }));

    return res.json({ message: "Order cancelled successfully" });
  } catch (error) {
    logger.error("Cancel order error", { error });
    return res.status(500).json({ error: "Failed to cancel order" });
  }
}));

// PUT /api/orders/:id/modify — Modify order before processing
router.put("/:id/modify", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { shippingAddress, notes, addItems, removeItems } = req.body;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    if (order.userId !== userId && order.customerEmail !== req.user!.email) {
      return res.status(403).json({ error: "Not authorized" });
    }
    if (order.status !== "PENDING") {
      return res.status(400).json({ error: "Only PENDING orders can be modified" });
    }

    // Block modification if payment has been initiated
    const activePayment = await prisma.payment.findFirst({
      where: { orderId: id, status: { not: "PENDING" } },
    });
    if (activePayment) {
      return res.status(400).json({ error: "Cannot modify order after payment has been initiated" });
    }

    await prisma.$transaction(async (tx) => {
      // Update shipping address and notes
      const updateData: any = {};
      if (shippingAddress) updateData.shippingAddress = typeof shippingAddress === "string" ? shippingAddress : JSON.stringify(shippingAddress);
      if (notes !== undefined) updateData.notes = notes;

      if (Object.keys(updateData).length > 0) {
        await tx.order.update({ where: { id }, data: updateData });
      }

      // Remove items and release their stock reservations
      if (removeItems && Array.isArray(removeItems) && removeItems.length > 0) {
        const removedItems = await tx.orderItem.findMany({
          where: { id: { in: removeItems }, orderId: id },
        });
        await tx.orderItem.deleteMany({
          where: { id: { in: removeItems }, orderId: id },
        });
        // Release stock reservations for removed items
        for (const item of removedItems) {
          const reservation = await tx.stockReservation.findFirst({
            where: { orderId: id, productId: item.productId, variantId: item.variantId || null, released: false },
          });
          if (reservation) {
            if (reservation.variantId) {
              await tx.productVariant.update({
                where: { id: reservation.variantId },
                data: { reservedStock: { decrement: reservation.quantity } },
              });
            } else {
              await tx.product.update({
                where: { id: item.productId },
                data: { reservedStock: { decrement: reservation.quantity } },
              });
            }
            await tx.stockReservation.update({
              where: { id: reservation.id },
              data: { released: true },
            });
          }
        }
      }

      // Add items and create stock reservations
      if (addItems && Array.isArray(addItems) && addItems.length > 0) {
        for (const item of addItems) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product) continue;

          // FIX H4: Reject archived, draft, or pending-review products
          const allowedStatuses = ["ACTIVE", "PUBLISHED"];
          if (!allowedStatuses.includes(product.status)) {
            throw new Error(`"${product.name}" is not available for purchase (status: ${product.status}).`);
          }

          const qty = item.quantity;
          if (!qty || qty < 1 || !Number.isInteger(qty)) {
            throw new Error(`Invalid quantity for "${product.name}". Must be a positive integer.`);
          }

          const variant = item.variantId
            ? await tx.productVariant.findUnique({ where: { id: item.variantId } })
            : null;
          if (item.variantId && (!variant || variant.productId !== product.id)) {
            throw new Error(`Selected variant for "${product.name}" is not available.`);
          }

          await tx.orderItem.create({
            data: {
              orderId: id,
              productId: item.productId,
              variantId: item.variantId || null,
              name: variant ? `${product.name} — ${variant.name}` : product.name,
              price: variant?.price ?? product.price,
              quantity: qty,
            },
          });

          // Atomically reserve stock using the shared helper
          if (product.trackInventory && !product.allowBackorder) {
            const reserveResult = await reserveStock(tx, [{
              productId: item.productId,
              variantId: item.variantId || null,
              quantity: qty,
              product: { name: product.name },
            }], id);
            if (!reserveResult.success) {
              throw new Error(reserveResult.error);
            }
          }
        }
      }

      // Recalculate totals
      const updatedItems = await tx.orderItem.findMany({ where: { orderId: id } });
      const subtotal = updatedItems.reduce(
        (sum, item) => sum + Number(item.price) * item.quantity,
        0
      );
      const currentOrder = await tx.order.findUnique({ where: { id }, include: { coupon: true, payments: true } });
      const totalAmount = subtotal - Number(currentOrder!.discount) + Number(currentOrder!.shippingCost) + Number(currentOrder!.tax);

      // Re-validate checkout rules after item changes
      const productIds = updatedItems.map((i) => i.productId);
      const products = await tx.product.findMany({ where: { id: { in: productIds } } });
      const productMap = new Map(products.map((p) => [p.id, p]));

      // 1. Delivery method eligibility
      const ALL_DELIVERY_METHODS = ["HOME_DELIVERY", "PICKUP", "SELLER_PICKUP"];
      let allowedMethods: string[] = ALL_DELIVERY_METHODS;
      for (const item of updatedItems) {
        const product = productMap.get(item.productId);
        if (!product) continue;
        const methods = product.allowedDeliveryMethods?.length > 0
          ? product.allowedDeliveryMethods
          : ALL_DELIVERY_METHODS;
        allowedMethods = allowedMethods.filter((m) => methods.includes(m));
      }
      if (!allowedMethods.includes(currentOrder!.deliveryMethod)) {
        throw new Error(`Current delivery method is no longer valid for the items in this order.`);
      }

      // 2. COD eligibility
      const hasCodPayment = currentOrder!.payments.some((p) => p.method === "COD" || p.provider === "cod");
      if (hasCodPayment) {
        const allAllowCod = products.every((p) => p.codAllowed !== false);
        if (!allAllowCod) {
          throw new Error("Cash on Delivery is no longer available for one or more items in your order.");
        }
      }

      // 3. Coupon minimum order
      if (currentOrder!.coupon) {
        const coupon = currentOrder!.coupon;
        const minOrder = Number(coupon.minOrderAmount || 0);
        if (subtotal < minOrder) {
          throw new Error(`Coupon "${coupon.code}" requires a minimum subtotal of ${minOrder}. Current subtotal: ${subtotal}.`);
        }
      }

      await tx.order.update({
        where: { id },
        data: {
          subtotal: new Decimal(subtotal),
          totalAmount: new Decimal(Math.max(totalAmount, 0)),
        },
      });

      // Update pending payment records to match new total
      await tx.payment.updateMany({
        where: { orderId: id, status: "PENDING" },
        data: { amount: new Decimal(Math.max(totalAmount, 0)) },
      });

      await tx.orderEvent.create({
        data: { orderId: id, status: "MODIFIED", note: "Order modified by customer" },
      });
    });

    // Return updated order
    const updated = await prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: { select: { name: true, slug: true } } } } },
    });

    return res.json({ message: "Order modified", order: updated });
  } catch (error) {
    logger.error("Modify order error", { error });
    return res.status(500).json({ error: "Failed to modify order" });
  }
}));

// POST /api/orders/:id/redirect — Redirect order in transit
router.post("/:id/redirect", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { shippingAddress, deliveryMethod, pickupPointId } = req.body;

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    if (order.userId !== userId && order.customerEmail !== req.user!.email) {
      return res.status(403).json({ error: "Not authorized" });
    }
    
    // Check if order is already delivered or cancelled
    if (["DELIVERED", "CANCELLED", "REFUNDED"].includes(order.status)) {
      return res.status(400).json({ error: `Cannot redirect order with status "${order.status}"` });
    }

    const updateData: any = {};
    let feeApplied = 0;
    
    // If order has been shipped or is processing, apply a fee
    if (["SHIPPED", "PROCESSING"].includes(order.status)) {
      feeApplied = 5000; // 5,000 UGX redirect fee
    }

    if (deliveryMethod === "pickup" && pickupPointId) {
      const pickupPoint = await prisma.pickupPoint.findUnique({
        where: { id: pickupPointId }
      });
      if (!pickupPoint) {
        return res.status(400).json({ error: "Pickup point not found" });
      }
      updateData.deliveryMethod = "pickup";
      updateData.pickupPointId = pickupPointId;
      updateData.shippingAddress = JSON.stringify({
        address: pickupPoint.address,
        city: pickupPoint.city,
        county: pickupPoint.county,
        country: "Uganda",
        name: pickupPoint.name,
        phone: pickupPoint.phone
      });
      updateData.latitude = pickupPoint.lat || null;
      updateData.longitude = pickupPoint.lng || null;
    } else if (shippingAddress) {
      updateData.deliveryMethod = "home";
      updateData.pickupPointId = null;
      updateData.shippingAddress = typeof shippingAddress === "string" ? shippingAddress : JSON.stringify(shippingAddress);
      if (typeof shippingAddress === "object") {
        updateData.latitude = shippingAddress.latitude || null;
        updateData.longitude = shippingAddress.longitude || null;
      }
    } else {
      return res.status(400).json({ error: "New shipping address or pickup point is required" });
    }

    if (feeApplied > 0) {
      updateData.totalAmount = { increment: feeApplied };
    }

    const updated = await prisma.order.update({
      where: { id },
      data: updateData,
    });

    // Create a new timeline event
    await prisma.orderEvent.create({
      data: {
        orderId: id,
        status: "REDIRECTED",
        note: `Order redirected to new destination.${feeApplied > 0 ? ` Redirection fee of 5,000 applied.` : ""}`
      }
    });

    return res.json({
      message: "Order redirected successfully",
      feeApplied,
      order: updated
    });
  } catch (error) {
    logger.error("Redirect order error", { error });
    return res.status(500).json({ error: "Failed to redirect order" });
  }
}));

// POST /api/orders/:id/confirm-delivery — Buyer confirms delivery (releases escrow)
router.post("/:id/confirm-delivery", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        escrow: true,
        payments: { select: { provider: true, method: true } },
        items: { select: { sellerId: true, price: true, quantity: true, commission: true, shippingFeeCharged: true } },
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.userId !== userId && order.customerEmail !== req.user!.email) {
      return res.status(403).json({ error: "Not authorized" });
    }

    if (!["SHIPPED", "DELIVERED"].includes(order.status)) {
      return res.status(400).json({ error: "Order must be shipped or delivered to confirm" });
    }

    if (order.deliveryConfirmedAt) {
      return res.status(400).json({ error: "Delivery has already been confirmed" });
    }

    await prisma.$transaction(async (tx) => {
      // Update order status to DELIVERED
      if (order.status !== "DELIVERED") {
        await tx.order.update({
          where: { id },
          data: { status: "DELIVERED" },
        });
        await approveAffiliateConversions(id, tx);
      }

      // Release escrow if exists
      if (order.escrow && order.escrow.status === "HELD") {
        await tx.escrowTransaction.update({
          where: { id: order.escrow.id },
          data: {
            status: "RELEASED",
            releasedAt: new Date(),
            releasedTo: order.items[0]?.sellerId || null,
            notes: "Released by buyer confirmation",
          },
        });

        // Credit seller balances ONLY if payment method was Cash on Delivery (COD).
        // For cards/momo/paypal/store-credit, the seller was already credited at checkout or webhook capture.
        const isCod = order.payments.some(p => p.provider === "cod" || p.method === "COD");
        if (isCod) {
          const sellerAmounts: Record<string, number> = {};
          for (const item of order.items) {
            if (item.sellerId) {
              const itemTotal = parseFloat(item.price.toString()) * item.quantity;
              const commission = item.commission ? parseFloat(item.commission.toString()) : itemTotal * 0.15;
              const shippingFeeDeduction = item.shippingFeeCharged ? parseFloat(item.shippingFeeCharged.toString()) : 0;
              const sellerAmount = itemTotal - commission - shippingFeeDeduction;
              sellerAmounts[item.sellerId] = (sellerAmounts[item.sellerId] || 0) + sellerAmount;
            }
          }

          for (const [sellerId, amount] of Object.entries(sellerAmounts)) {
            await tx.seller.update({
              where: { id: sellerId },
              data: {
                balance: { increment: amount },
                totalEarnings: { increment: amount },
                totalSales: { increment: 1 },
              },
            });
          }
        }
      }

      // Add timeline event
      await tx.orderEvent.create({
        data: {
          orderId: id,
          status: "DELIVERY_CONFIRMED",
          note: "Delivery confirmed by buyer — payment released to seller",
        },
      });
    });

    enqueueNotification({
      event: "ORDER_DELIVERED",
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
      },
    }).catch((err) => logger.error("Failed to enqueue delivery notification", { error: err }));

    return res.json({ message: "Delivery confirmed. Payment has been released to the seller." });
  } catch (error) {
    logger.error("Confirm delivery error", { error });
    return res.status(500).json({ error: "Failed to confirm delivery" });
  }
}));

// GET /api/orders/:id/escrow — Get escrow status for an order
router.get("/:id/escrow", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      select: {
        userId: true,
        customerEmail: true,
        escrow: true,
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const isOwner = order.userId === req.user!.id || order.customerEmail === req.user!.email;
    const isAdmin = req.user!.role === "ADMIN" || req.user!.role === "MANAGER";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Not authorized" });
    }

    return res.json({
      escrow: order.escrow || null,
      protected: !!order.escrow,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch escrow status" });
  }
}));

export default router;
