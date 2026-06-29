/**
 * AliExpress Sync Jobs
 * - Tracking sync: fetches tracking numbers for placed orders (every 6 hours)
 * - Price/stock sync: updates product prices and stock daily
 */

import prisma from "../lib/prisma";
import { getOrderTracking, getProductDetail, calculateSellingPrice } from "./aliexpress";
import { awardPurchasePoints } from "../routes/loyalty";
import { logger } from "../lib/logger";

// ── Tracking Sync ──

async function syncTracking(): Promise<void> {
  logger.info("[AE-Sync] Starting tracking sync...");

  const pendingOrders = await prisma.aliExpressOrder.findMany({
    where: {
      status: { in: ["PLACED", "SHIPPED"] },
      aliexpressOrderId: { not: null },
    },
    include: {
      order: { select: { id: true, orderNumber: true, userId: true, totalAmount: true } },
      product: { select: { name: true } },
    },
    take: 50,
  });

  if (pendingOrders.length === 0) {
    logger.info("[AE-Sync] No orders to track");
    return;
  }

  let updated = 0;
  for (const aeOrder of pendingOrders) {
    try {
      const tracking = await getOrderTracking(aeOrder.aliexpressOrderId!);
      if (!tracking) continue;

      const updates: any = {};

      if (tracking.trackingNumber && tracking.trackingNumber !== aeOrder.trackingNumber) {
        updates.trackingNumber = tracking.trackingNumber;
        updates.trackingUrl = tracking.trackingUrl || null;
        updates.shippingCarrier = tracking.carrier || null;
      }

      // Update status based on AliExpress order status
      const aeStatus = tracking.status?.toUpperCase() || "";
      if (aeStatus.includes("SHIPPED") || aeStatus.includes("IN_TRANSIT") || tracking.trackingNumber) {
        if (aeOrder.status !== "SHIPPED") {
          updates.status = "SHIPPED";
          updates.shippedAt = new Date();
        }
      }
      if (aeStatus.includes("FINISH") || aeStatus.includes("DELIVERED") || aeStatus.includes("COMPLETED")) {
        if (aeOrder.status !== "DELIVERED") {
          updates.status = "DELIVERED";
          updates.deliveredAt = new Date();
        }
      }
      if (aeStatus.includes("CANCEL")) {
        updates.status = "CANCELLED";
      }

      if (Object.keys(updates).length > 0) {
        await prisma.aliExpressOrder.update({
          where: { id: aeOrder.id },
          data: updates,
        });

        // Update the main order tracking number and status
        if (updates.trackingNumber) {
          await prisma.order.update({
            where: { id: aeOrder.order.id },
            data: {
              trackingNumber: updates.trackingNumber,
              status: "SHIPPED",
            },
          });

          await prisma.orderEvent.create({
            data: {
              orderId: aeOrder.order.id,
              status: "SHIPPED",
              note: `Tracking: ${updates.trackingNumber} via ${updates.shippingCarrier || "carrier"}`,
            },
          });
        }

        if (updates.status === "DELIVERED") {
          await prisma.order.update({
            where: { id: aeOrder.order.id },
            data: { status: "DELIVERED" },
          });

          await prisma.orderEvent.create({
            data: {
              orderId: aeOrder.order.id,
              status: "DELIVERED",
              note: "Package delivered to customer",
            },
          });

          // Award loyalty points on AliExpress delivery
          if (aeOrder.order.userId) {
            awardPurchasePoints(aeOrder.order.userId, Number(aeOrder.order.totalAmount), aeOrder.order.id)
              .catch(err => logger.error("Failed to award points on AE delivery", { error: err }));
          }
        }

        updated++;
        logger.info(`[AE-Sync] Updated ${aeOrder.order.orderNumber} - ${aeOrder.product.name}: ${JSON.stringify(updates)}`);
      }
    } catch (error: any) {
      logger.error(`[AE-Sync] Tracking error for AE order ${aeOrder.aliexpressOrderId}`, { error: error.message });
    }

    // Rate limit: small delay between API calls
    await new Promise((r) => setTimeout(r, 500));
  }

  logger.info(`[AE-Sync] Tracking sync done. Updated ${updated}/${pendingOrders.length} orders.`);
}

// ── Price & Stock Sync ──

async function syncPricesAndStock(): Promise<void> {
  logger.info("[AE-Sync] Starting price/stock sync...");

  const products = await prisma.product.findMany({
    where: {
      aliexpressProductId: { not: null },
      aliexpressAutoSync: true,
    },
    orderBy: {
      lastSyncedAt: "asc",
    },
    take: 100,
  });

  if (products.length === 0) {
    logger.info("[AE-Sync] No products to sync");
    return;
  }

  let updated = 0;
  let errors = 0;

  for (const product of products) {
    try {
      const detail = await getProductDetail(product.aliexpressProductId!);
      const oldCost = Number(product.aliexpressCost);
      const newCost = detail.price;
      const dataUpdate: any = { lastSyncedAt: new Date() };

      if (Math.abs(oldCost - newCost) > 0.01 && product.markupType && product.markupValue) {
        dataUpdate.aliexpressCost = newCost;
        dataUpdate.price = calculateSellingPrice(
          newCost,
          product.markupType as "PERCENTAGE" | "FIXED",
          Number(product.markupValue),
        );
        logger.info(`[AE-Sync] Price changed for "${product.name}": $${oldCost} → $${newCost}, selling: $${dataUpdate.price}`);
      }

      const newStock = detail.variants.reduce((sum, v) => sum + v.stock, 0);
      if (newStock > 0 && product.stock !== newStock) {
        dataUpdate.stock = newStock;
      }

      await prisma.product.update({
        where: { id: product.id },
        data: dataUpdate,
      });

      if (Object.keys(dataUpdate).length > 1) updated++;
    } catch (error: any) {
      errors++;
      logger.error(`[AE-Sync] Price sync error for "${product.name}"`, { error: error.message });
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, 1000));
  }

  logger.info(`[AE-Sync] Price/stock sync done. Updated ${updated}, errors ${errors}, total ${products.length}`);
}

// ── Job Schedulers ──

const SIX_HOURS = 6 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export function startTrackingSyncJob(): void {
  logger.info("AliExpress tracking sync job started (every 6 hours)");
  // Run once on startup after a brief delay, then every 6 hours
  setTimeout(() => {
    syncTracking().catch(err => logger.error('ae_tracking_sync_failed', { error: err }));
    setInterval(() => syncTracking().catch(err => logger.error('ae_tracking_sync_failed', { error: err })), SIX_HOURS);
  }, 30000);
}

export function startPriceSyncJob(): void {
  logger.info("AliExpress price/stock sync job started (every 24 hours)");
  // Run once on startup after a brief delay, then daily
  setTimeout(() => {
    syncPricesAndStock().catch(err => logger.error('ae_price_sync_failed', { error: err }));
    setInterval(() => syncPricesAndStock().catch(err => logger.error('ae_price_sync_failed', { error: err })), TWENTY_FOUR_HOURS);
  }, 60000);
}
