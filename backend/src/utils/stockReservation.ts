import prisma from "../lib/prisma";
import { logger } from "../lib/logger";
import { Prisma } from "@prisma/client";

const SPLIT_PAYMENT_WINDOW_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_RESERVATION_TIMEOUT_MS = 15 * 60 * 1000;

export interface ReserveStockItem {
  productId: string;
  quantity: number;
  product: { name: string };
  variantId?: string | null;
}

/**
 * Check and reserve stock for cart/order items inside a Prisma transaction.
 * Uses `SELECT ... FOR UPDATE` to prevent TOCTOU race conditions.
 *
 * When a `variantId` is provided, stock is reserved against the variant;
 * otherwise it falls back to the parent product stock.
 */
export async function reserveStock(
  tx: Prisma.TransactionClient,
  items: ReserveStockItem[],
  orderId: string,
  reservationTimeoutMs: number = DEFAULT_RESERVATION_TIMEOUT_MS
): Promise<{ success: boolean; error?: string }> {
  const expiresAt = new Date(Date.now() + reservationTimeoutMs);

  for (const item of items) {
    // 1. Fetch product configuration without locking
    const [product] = await tx.$queryRaw<any[]>`
      SELECT name, "trackInventory", "allowBackorder" FROM "Product" WHERE id = ${item.productId}`;
    
    if (!product) {
      return { success: false, error: `Product "${item.product.name}" no longer exists.` };
    }

    // Skip inventory check if not tracking or allows backorder
    if (!product.trackInventory || product.allowBackorder) {
      await tx.stockReservation.create({
        data: {
          orderId,
          productId: item.productId,
          variantId: item.variantId || null,
          quantity: item.quantity,
          expiresAt,
        },
      });
      continue;
    }

    if (item.variantId) {
      // 2a. Fetch variant configuration without locking
      const [variant] = await tx.$queryRaw<any[]>`
        SELECT name FROM "ProductVariant" WHERE id = ${item.variantId}`;
      if (!variant) {
        return { success: false, error: `Selected variant for "${product.name}" is no longer available.` };
      }

      // 2b. Atomic check-and-update update query for variant reservedStock
      const updatedRows = await tx.$executeRaw`
        UPDATE "ProductVariant"
        SET "reservedStock" = "reservedStock" + ${item.quantity}
        WHERE id = ${item.variantId}
          AND "stock" >= "reservedStock" + ${item.quantity}
      `;

      if (updatedRows === 0) {
        return {
          success: false,
          error: `Insufficient stock for "${product.name}" (${variant.name}).`,
        };
      }

      await tx.stockReservation.create({
        data: {
          orderId,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          expiresAt,
        },
      });
    } else {
      // 3. Atomic check-and-update update query for product reservedStock
      const updatedRows = await tx.$executeRaw`
        UPDATE "Product"
        SET "reservedStock" = "reservedStock" + ${item.quantity}
        WHERE id = ${item.productId}
          AND "stock" >= "reservedStock" + ${item.quantity}
      `;

      if (updatedRows === 0) {
        return {
          success: false,
          error: `Insufficient stock for "${product.name}".`,
        };
      }

      await tx.stockReservation.create({
        data: {
          orderId,
          productId: item.productId,
          variantId: null,
          quantity: item.quantity,
          expiresAt,
        },
      });
    }
  }

  return { success: true };
}

/**
 * Release expired stock reservations with batching to prevent event loop blocking
 * Processes 1000 reservations at a time with yielding between batches
 * Prevents 60+ second blocking during peak hours
 */
export async function releaseExpiredReservations(): Promise<number> {
  const now = new Date();
  const BATCH_SIZE = 1000;
  let totalReleased = 0;
  let batchCount = 0;

  while (true) {
    batchCount++;

    // Find batch of expired, unreleased reservations
    const expiredReservations = await prisma.stockReservation.findMany({
      where: {
        expiresAt: { lt: now },
        released: false,
      },
      take: BATCH_SIZE,
      select: {
        id: true,
        orderId: true,
        productId: true,
        variantId: true,
        quantity: true,
      },
    });

    if (expiredReservations.length === 0) {
      break; // No more expired reservations
    }

    // Batch-load order context so we can handle split-payment orders correctly.
    // Split payments get a 24-hour partner window after the first successful payment.
    const orderIds = [...new Set(expiredReservations.map((r) => r.orderId))];
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: {
        id: true,
        isSplitPayment: true,
        splitPartnerPaid: true,
        payments: {
          where: { status: "SUCCESSFUL" },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    });
    const orderMap = new Map(orders.map((o) => [o.id, o]));

    // Compute the partner-payment deadline for split orders.
    // Reservations for split orders whose partner has not yet paid should be
    // extended rather than cancelled, as long as we are still inside the 24h window.
    const splitDeadlineByOrderId = new Map<string, Date>();
    for (const order of orders) {
      if (
        order.isSplitPayment &&
        !order.splitPartnerPaid &&
        order.payments.length > 0 &&
        order.payments[0].createdAt
      ) {
        const deadline = new Date(order.payments[0].createdAt.getTime() + SPLIT_PAYMENT_WINDOW_MS);
        splitDeadlineByOrderId.set(order.id, deadline);
      }
    }

    // Process batch in transaction. Lock the reservation rows first to prevent
    // concurrent cleanup jobs or racing webhooks from releasing the same stock twice.
    const reservationIds = expiredReservations.map((r) => r.id);
    await prisma.$transaction(async (tx) => {
      const lockedReservations = await tx.$queryRaw<any[]>`
        SELECT * FROM "StockReservation"
        WHERE id = ANY(${reservationIds}::text[])
          AND released = false
        FOR UPDATE`;
      const lockedIds = new Set(lockedReservations.map((r) => r.id));

      for (const reservation of expiredReservations) {
        // Skip if another transaction already grabbed and released this row.
        if (!lockedIds.has(reservation.id)) continue;

        const splitDeadline = splitDeadlineByOrderId.get(reservation.orderId);

        // Split-payment orders waiting for the partner keep their stock reserved
        // for the full 24-hour partner window after the first successful payment.
        if (splitDeadline && splitDeadline > now) {
          await tx.stockReservation.update({
            where: { id: reservation.id },
            data: { expiresAt: splitDeadline },
          });
          continue;
        }

        // Release reserved stock (variant-level when applicable)
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

        // Mark reservation as released
        await tx.stockReservation.update({
          where: { id: reservation.id },
          data: { released: true },
        });

        // Cancel the order if still pending
        const updatedOrders = await tx.order.updateMany({
          where: {
            id: reservation.orderId,
            status: "PENDING",
          },
          data: {
            status: "CANCELLED",
            paymentStatus: "FAILED",
          },
        });

        if (updatedOrders.count > 0) {
          await tx.orderEvent.create({
            data: {
              orderId: reservation.orderId,
              status: "CANCELLED",
              note: splitDeadline
                ? "Order automatically cancelled: Split-payment partner did not pay within the 24-hour window"
                : "Order automatically cancelled: Payment was not completed within the stock reservation window",
            },
          });
          const { refundStoreCreditForOrder } = await import("./storeCredit");
          await refundStoreCreditForOrder(tx, reservation.orderId);
        }
      }
    });

    totalReleased += expiredReservations.length;

    // Yield to event loop between batches (prevent blocking)
    // setTimeout with 0 allows other requests to process
    if (expiredReservations.length === BATCH_SIZE) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  if (totalReleased > 0) {
    logger.info(`Released ${totalReleased} expired stock reservations in ${batchCount} batches`);
  }
  return totalReleased;
}

// Run cleanup every 5 minutes in production
let cleanupInterval: NodeJS.Timeout | null = null;

export function startReservationCleanup() {
  if (cleanupInterval) return;

  // Run immediately on startup
  releaseExpiredReservations().catch((err) => logger.error("release_expired_reservations_failed", { error: err }));

  // Then run every 5 minutes
  cleanupInterval = setInterval(() => {
    releaseExpiredReservations().catch((err) => logger.error("release_expired_reservations_failed", { error: err }));
  }, 5 * 60 * 1000);

  logger.info("Stock reservation cleanup job started");
}

export function stopReservationCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}
