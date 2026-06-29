import { Prisma } from "@prisma/client";
import { getCommissionRates } from "../routes/seller";
import { logger } from "../lib/logger";

export interface ConfirmOrderOptions {
  /**
   * Pass the order with items if already loaded to avoid an extra query.
   */
  order?: any;
  /**
   * Whether to create/update an escrow record for buyer protection.
   * Default: true.
   */
  createEscrow?: boolean;
}

/**
 * Shared post-payment confirmation logic.
 *
 * Should be called inside an existing transaction once a payment has been
 * verified and the order should move to a paid/confirmed state. It:
 *
 *  - Claims active price slashes
 *  - Finalizes stock (decrement actual stock and release reservations)
 *  - Credits seller earnings
 *  - Creates an escrow record for buyer protection
 *  - Updates order status to CONFIRMED / paymentStatus SUCCESSFUL
 *
 * This prevents the same logic from being duplicated in the Flutterwave
 * webhook, PayPal return handler, admin mark-paid, etc.
 */
export async function confirmPaidOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
  options: ConfirmOrderOptions = {}
): Promise<any> {
  const createEscrow = options.createEscrow !== false;

  let order = options.order;
  if (!order) {
    order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
  }

  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  // Re-fetch current status inside the transaction to avoid stale-data decisions.
  const currentOrder = await tx.order.findUnique({
    where: { id: orderId },
    select: { status: true, paymentStatus: true },
  });

  // Idempotency: if already fully paid, skip the financial updates.
  if (currentOrder?.paymentStatus === "SUCCESSFUL") {
    return order;
  }

  // Only move status forward from PENDING -> CONFIRMED. If the order is already
  // CONFIRMED/SHIPPED/DELIVERED, leave it alone.
  const nextStatus = currentOrder?.status === "PENDING" ? "CONFIRMED" : undefined;
  await tx.order.update({
    where: { id: orderId },
    data: {
      ...(nextStatus ? { status: nextStatus } : {}),
      paymentStatus: "SUCCESSFUL",
    },
  });

  // Claim active price slashes
  if (order.userId && order.items && order.items.length > 0) {
    await tx.priceSlash.updateMany({
      where: {
        initiatorId: order.userId,
        productId: { in: order.items.map((i: any) => i.productId) },
        status: "active",
      },
      data: { status: "claimed" },
    });
  }

  // Finalize stock: decrement actual stock and release reservation
  const reservations = await tx.stockReservation.findMany({
    where: { orderId, released: false },
  });

  if (reservations.length > 0) {
    for (const reservation of reservations) {
      if (reservation.variantId) {
        await tx.productVariant.update({
          where: { id: reservation.variantId },
          data: {
            stock: { decrement: reservation.quantity },
            reservedStock: { decrement: reservation.quantity },
          },
        });
      } else {
        await tx.product.update({
          where: { id: reservation.productId },
          data: {
            stock: { decrement: reservation.quantity },
            reservedStock: { decrement: reservation.quantity },
          },
        });
      }

      await tx.stockReservation.update({
        where: { id: reservation.id },
        data: { released: true },
      });
    }
  } else {
    // Self-heal: reservations were already released (expired/cancelled), but payment succeeded!
    // Guard against negative inventory before decrementing.
    for (const item of order.items) {
      if (item.variantId) {
        const [variant] = await tx.$queryRaw<any[]>`
          SELECT id, stock FROM "ProductVariant" WHERE id = ${item.variantId} FOR UPDATE`;
        if (!variant) continue;
        if (Number(variant.stock) < item.quantity) {
          logger.error("self_heal_variant_stock_insufficient", {
            variantId: item.variantId,
            available: Number(variant.stock),
            required: item.quantity,
            orderId,
          });
        } else {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { decrement: item.quantity } },
          });
        }
      } else {
        const [product] = await tx.$queryRaw<any[]>`
          SELECT id, stock FROM "Product" WHERE id = ${item.productId} FOR UPDATE`;
        if (!product) continue;
        if (Number(product.stock) < item.quantity) {
          logger.error("self_heal_stock_insufficient", {
            productId: item.productId,
            available: Number(product.stock),
            required: item.quantity,
            orderId,
          });
        } else {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          });
        }
      }
    }
  }

  // Credit seller earnings for marketplace items
  const sellerItems = await tx.orderItem.findMany({
    where: { orderId, sellerId: { not: null } },
    include: { product: { select: { categoryId: true } } },
  });

  const rateMap = await getCommissionRates(
    sellerItems.map((i) => ({ sellerId: i.sellerId!, categoryId: i.product?.categoryId || null }))
  );

  const sellerEarnings: Record<string, { net: number; sales: number }> = {};
  for (const item of sellerItems) {
    const rateKey = `${item.sellerId!}:${item.product?.categoryId || ""}`;
    const rate = rateMap.get(rateKey) ?? 15;
    const itemTotal = Number(item.price) * item.quantity;
    const commission = Math.round((itemTotal * rate) / 100);
    const shippingFeeDeduction = item.shippingFeeCharged ? Number(item.shippingFeeCharged) : 0;
    const net = itemTotal - commission - shippingFeeDeduction;

    await tx.orderItem.update({
      where: { id: item.id },
      data: { commission },
    });

    if (!sellerEarnings[item.sellerId!]) {
      sellerEarnings[item.sellerId!] = { net: 0, sales: 0 };
    }
    sellerEarnings[item.sellerId!].net += net;
    sellerEarnings[item.sellerId!].sales += item.quantity;
  }

  for (const [sellerId, earnings] of Object.entries(sellerEarnings)) {
    await tx.seller.update({
      where: { id: sellerId },
      data: {
        // Credit to pendingBalance — released to available balance on delivery
        // confirmation or escrow auto-release.
        pendingBalance: { increment: earnings.net },
        totalEarnings: { increment: earnings.net },
        totalSales: { increment: earnings.sales },
      },
    });
  }

  // Create escrow for buyer protection
  if (createEscrow) {
    await tx.escrowTransaction.create({
      data: {
        orderId,
        amount: Number(order.totalAmount),
        currency: order.currency || "UGX",
        status: "HELD",
        releaseDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }).catch((err) => {
      // Ignore unique-constraint violations (escrow already exists).
      if (err?.code !== "P2002") {
        logger.error("Escrow creation failed", { orderId, error: err });
      }
    });
  }

  return order;
}

/**
 * Release all outstanding stock reservations for an order and fail any pending payments.
 * Used when a payment fails or is cancelled.
 */
export async function releaseOrderStock(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<void> {
  const reservations = await tx.stockReservation.findMany({
    where: { orderId, released: false },
  });

  for (const reservation of reservations) {
    if (reservation.variantId) {
      await tx.productVariant.update({
        where: { id: reservation.variantId },
        data: {
          reservedStock: { decrement: reservation.quantity },
        },
      });
    } else {
      await tx.product.update({
        where: { id: reservation.productId },
        data: {
          reservedStock: { decrement: reservation.quantity },
        },
      });
    }

    await tx.stockReservation.update({
      where: { id: reservation.id },
      data: { released: true },
    });
  }
}
