import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest, optionalAuth } from "../middleware/auth";
import { sendCancelledNotification } from "../lib/email";
import { Decimal } from "@prisma/client/runtime/library";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

// GET /api/orders/track/:orderNumber - Track order (requires email for verification)
router.get("/track/:orderNumber", asyncHandler(async (req: Request, res: Response) => {
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
      customerName: order.customerName?.split(" ")[0] || "Customer",
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
    logger.error("Track order error", { error });
    return res.status(500).json({ error: "Failed to fetch order" });
  }
}));

// GET /api/orders/:id/payment-status — Poll payment status (auth + ownership)
router.get("/:id/payment-status", optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      select: { paymentStatus: true, status: true, orderNumber: true, userId: true, customerEmail: true },
    });
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    // Verify ownership: user must own the order or match the email.
    // For guest checkouts (no user), allow access by order ID (UUIDs are unguessable)
    // since the caller just created the order and has the ID.
    const user = req.user;
    const isOwner = user && (order.userId === user.id || order.customerEmail === user.email);
    const isAdmin = user && (user.role === "ADMIN" || user.role === "MANAGER");
    const isGuestOrder = !order.userId;
    if (!isOwner && !isAdmin && !isGuestOrder) {
      return res.status(404).json({ error: "Order not found" });
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

// GET /api/orders/:id — requires authentication + ownership check
router.get("/:id", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
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

    // Verify ownership: user must own the order or be an admin
    const user = req.user;
    const isOwner = user && (order.userId === user.id || order.customerEmail === user.email);
    const isAdmin = user && (user.role === "ADMIN" || user.role === "MANAGER");
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Not authorized to view this order" });
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
        where: { cartId_productId: { cartId: cart.id, productId: item.productId } },
        update: { quantity: { increment: item.quantity } },
        create: { cartId: cart.id, productId: item.productId, quantity: item.quantity },
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
      include: { items: true },
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
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
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
    sendCancelledNotification(order, "Cancelled by customer").catch(err => logger.error('send_cancelled_notification_failed', { error: err }));

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
            where: { orderId: id, productId: item.productId, released: false },
          });
          if (reservation) {
            await tx.product.update({
              where: { id: item.productId },
              data: { reservedStock: { decrement: reservation.quantity } },
            });
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
          const qty = item.quantity;
          if (!qty || qty < 1 || !Number.isInteger(qty)) {
            throw new Error(`Invalid quantity for "${product.name}". Must be a positive integer.`);
          }

          // Check available stock before adding
          if (product.trackInventory && !product.allowBackorder) {
            const available = product.stock - (product.reservedStock || 0);
            if (available < qty) {
              throw new Error(`Insufficient stock for "${product.name}". Available: ${available}`);
            }
          }

          await tx.orderItem.create({
            data: {
              orderId: id,
              productId: item.productId,
              name: product.name,
              price: product.price,
              quantity: qty,
            },
          });

          // Create stock reservation for added item
          if (product.trackInventory && !product.allowBackorder) {
            await tx.stockReservation.create({
              data: {
                orderId: id,
                productId: item.productId,
                quantity: qty,
                expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min, consistent with checkout
              },
            });
            await tx.product.update({
              where: { id: item.productId },
              data: { reservedStock: { increment: qty } },
            });
          }
        }
      }

      // Recalculate totals
      const updatedItems = await tx.orderItem.findMany({ where: { orderId: id } });
      const subtotal = updatedItems.reduce(
        (sum, item) => sum + Number(item.price) * item.quantity,
        0
      );
      const currentOrder = await tx.order.findUnique({ where: { id } });
      const totalAmount = subtotal - Number(currentOrder!.discount) + Number(currentOrder!.shippingCost) + Number(currentOrder!.tax);

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

// POST /api/orders/:id/confirm-delivery — Buyer confirms delivery (releases escrow)
router.post("/:id/confirm-delivery", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        escrow: true,
        items: { select: { sellerId: true, price: true, quantity: true, commission: true } },
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

    await prisma.$transaction(async (tx) => {
      // Update order status to DELIVERED
      if (order.status !== "DELIVERED") {
        await tx.order.update({
          where: { id },
          data: { status: "DELIVERED" },
        });
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

        // Credit seller balances
        const sellerAmounts: Record<string, number> = {};
        for (const item of order.items) {
          if (item.sellerId) {
            const itemTotal = parseFloat(item.price.toString()) * item.quantity;
            const commission = item.commission ? parseFloat(item.commission.toString()) : itemTotal * 0.15;
            const sellerAmount = itemTotal - commission;
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

      // Add timeline event
      await tx.orderEvent.create({
        data: {
          orderId: id,
          status: "DELIVERY_CONFIRMED",
          note: "Delivery confirmed by buyer — payment released to seller",
        },
      });
    });

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
