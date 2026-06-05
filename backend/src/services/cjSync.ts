/**
 * CJ Dropshipping Sync Jobs
 * - Tracking sync: every 6 hours
 * - Price/stock sync: daily
 */

import prisma from "../lib/prisma";
import { getOrderTracking, getProductDetail, calculateSellingPrice } from "./cjdropshipping";
import { logger } from "../lib/logger";

// ── Tracking Sync ──

async function syncCJTracking(): Promise<void> {
  logger.info("[CJ-Sync] Starting tracking sync...");

  const pendingOrders = await prisma.cJOrder.findMany({
    where: {
      status: { in: ["PLACED", "SHIPPED"] },
      cjOrderId: { not: null },
    },
    include: {
      order: { select: { id: true, orderNumber: true } },
      product: { select: { name: true } },
    },
    take: 50,
  });

  if (pendingOrders.length === 0) {
    logger.info("[CJ-Sync] No orders to track");
    return;
  }

  let updated = 0;
  for (const cjOrder of pendingOrders) {
    try {
      const tracking = await getOrderTracking(cjOrder.cjOrderId!);
      if (!tracking) continue;

      const updates: any = {};

      if (tracking.trackingNumber && tracking.trackingNumber !== cjOrder.trackingNumber) {
        updates.trackingNumber = tracking.trackingNumber;
        updates.trackingUrl = tracking.trackingUrl || null;
        updates.shippingCarrier = tracking.carrier || null;
      }

      const cjStatus = tracking.status?.toUpperCase() || "";
      if ((cjStatus.includes("SHIPPED") || cjStatus.includes("TRANSIT") || tracking.trackingNumber) && cjOrder.status !== "SHIPPED") {
        updates.status = "SHIPPED";
        updates.shippedAt = new Date();
      }
      if ((cjStatus.includes("DELIVER") || cjStatus.includes("COMPLETED")) && cjOrder.status !== "DELIVERED") {
        updates.status = "DELIVERED";
        updates.deliveredAt = new Date();
      }
      if (cjStatus.includes("CANCEL")) {
        updates.status = "CANCELLED";
      }

      if (Object.keys(updates).length > 0) {
        await prisma.cJOrder.update({ where: { id: cjOrder.id }, data: updates });

        if (updates.trackingNumber) {
          await prisma.order.update({
            where: { id: cjOrder.order.id },
            data: { trackingNumber: updates.trackingNumber, status: "SHIPPED" },
          });
          await prisma.orderEvent.create({
            data: {
              orderId: cjOrder.order.id,
              status: "SHIPPED",
              note: `CJ Tracking: ${updates.trackingNumber} via ${updates.shippingCarrier || "carrier"}`,
            },
          });
        }

        if (updates.status === "DELIVERED") {
          await prisma.order.update({ where: { id: cjOrder.order.id }, data: { status: "DELIVERED" } });
          await prisma.orderEvent.create({
            data: { orderId: cjOrder.order.id, status: "DELIVERED", note: "CJ package delivered" },
          });
        }

        updated++;
      }
    } catch (error: any) {
      logger.error(`[CJ-Sync] Tracking error for CJ order ${cjOrder.cjOrderId}`, { error: error.message });
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  logger.info(`[CJ-Sync] Tracking done. Updated ${updated}/${pendingOrders.length}`);
}

// ── Price & Stock Sync ──

async function syncCJPricesAndStock(): Promise<void> {
  logger.info("[CJ-Sync] Starting price/stock sync...");

  const products = await prisma.product.findMany({
    where: { cjProductId: { not: null }, cjAutoSync: true },
    take: 100,
  });

  if (products.length === 0) {
    logger.info("[CJ-Sync] No products to sync");
    return;
  }

  let updated = 0;
  let errors = 0;

  // Fetch USD→UGX exchange rate for price conversion
  let usdToUgx = 3700;
  try {
    const usdCurrency = await prisma.currency.findUnique({ where: { code: "USD" } });
    if (usdCurrency) usdToUgx = Math.round(1 / Number(usdCurrency.exchangeRate));
  } catch {}

  for (const product of products) {
    try {
      const detail = await getProductDetail(product.cjProductId!);
      const oldCost = Number(product.cjCost);
      const newCostUgx = Math.round(detail.price * usdToUgx);
      const dataUpdate: any = { lastSyncedAt: new Date() };

      if (Math.abs(oldCost - newCostUgx) > 1 && product.markupType && product.markupValue) {
        dataUpdate.cjCost = newCostUgx;
        dataUpdate.price = Math.round(calculateSellingPrice(
          newCostUgx,
          product.markupType as "PERCENTAGE" | "FIXED",
          Number(product.markupValue),
        ));
        logger.info(`[CJ-Sync] Price changed for "${product.name}": UGX ${oldCost} → UGX ${newCostUgx}`);
      }

      const newStock = detail.variants.reduce((sum, v) => sum + v.variantStock, 0);
      if (newStock > 0 && product.stock !== newStock) {
        dataUpdate.stock = newStock;
      }

      await prisma.product.update({ where: { id: product.id }, data: dataUpdate });
      if (Object.keys(dataUpdate).length > 1) updated++;
    } catch (error: any) {
      const msg = error.message || "";
      // Product removed from CJ shelves — disable auto-sync to stop retries
      if (msg.includes("1602002") || msg.includes("removed from shelves") || msg.includes("Product not found")) {
        logger.warn(`[CJ-Sync] Product "${product.name}" removed from CJ. Disabling auto-sync.`);
        await prisma.product.update({
          where: { id: product.id },
          data: { cjAutoSync: false, status: "ARCHIVED" },
        }).catch(() => {});
      } else {
        errors++;
        logger.error(`[CJ-Sync] Error for "${product.name}"`, { error: msg });
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  logger.info(`[CJ-Sync] Price sync done. Updated ${updated}, errors ${errors}, total ${products.length}`);
}

// ── Job Schedulers ──

const SIX_HOURS = 6 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export function startCJTrackingSyncJob(): void {
  logger.info("CJ Dropshipping tracking sync started (every 6 hours)");
  setTimeout(() => {
    syncCJTracking().catch(err => logger.error('cj_tracking_sync_failed', { error: err }));
    setInterval(() => syncCJTracking().catch(err => logger.error('cj_tracking_sync_failed', { error: err })), SIX_HOURS);
  }, 35000);
}

export function startCJPriceSyncJob(): void {
  logger.info("CJ Dropshipping price/stock sync started (every 24 hours)");
  setTimeout(() => {
    syncCJPricesAndStock().catch(err => logger.error('cj_price_sync_failed', { error: err }));
    setInterval(() => syncCJPricesAndStock().catch(err => logger.error('cj_price_sync_failed', { error: err })), TWENTY_FOUR_HOURS);
  }, 65000);
}
