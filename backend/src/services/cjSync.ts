/**
 * CJ Dropshipping Sync Jobs
 * - Tracking sync: every 6 hours
 * - Price/stock sync: daily
 */

import prisma from "../lib/prisma";
import { getOrderTracking, getProductDetail, calculateSellingPrice } from "./cjdropshipping";

// ── Tracking Sync ──

async function syncCJTracking(): Promise<void> {
  console.log("[CJ-Sync] Starting tracking sync...");

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
    console.log("[CJ-Sync] No orders to track");
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
      console.error(`[CJ-Sync] Tracking error for CJ order ${cjOrder.cjOrderId}:`, error.message);
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`[CJ-Sync] Tracking done. Updated ${updated}/${pendingOrders.length}`);
}

// ── Price & Stock Sync ──

async function syncCJPricesAndStock(): Promise<void> {
  console.log("[CJ-Sync] Starting price/stock sync...");

  const products = await prisma.product.findMany({
    where: { cjProductId: { not: null }, cjAutoSync: true },
    take: 100,
  });

  if (products.length === 0) {
    console.log("[CJ-Sync] No products to sync");
    return;
  }

  let updated = 0;
  let errors = 0;

  for (const product of products) {
    try {
      const detail = await getProductDetail(product.cjProductId!);
      const oldCost = Number(product.cjCost);
      const newCost = detail.price;
      const dataUpdate: any = { lastSyncedAt: new Date() };

      if (Math.abs(oldCost - newCost) > 0.01 && product.markupType && product.markupValue) {
        dataUpdate.cjCost = newCost;
        dataUpdate.price = calculateSellingPrice(
          newCost,
          product.markupType as "PERCENTAGE" | "FIXED",
          Number(product.markupValue),
        );
        console.log(`[CJ-Sync] Price changed for "${product.name}": $${oldCost} → $${newCost}`);
      }

      const newStock = detail.variants.reduce((sum, v) => sum + v.variantStock, 0);
      if (newStock > 0 && product.stock !== newStock) {
        dataUpdate.stock = newStock;
      }

      await prisma.product.update({ where: { id: product.id }, data: dataUpdate });
      if (Object.keys(dataUpdate).length > 1) updated++;
    } catch (error: any) {
      errors++;
      console.error(`[CJ-Sync] Error for "${product.name}":`, error.message);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`[CJ-Sync] Price sync done. Updated ${updated}, errors ${errors}, total ${products.length}`);
}

// ── Job Schedulers ──

const SIX_HOURS = 6 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export function startCJTrackingSyncJob(): void {
  console.log("📦 CJ Dropshipping tracking sync started (every 6 hours)");
  setTimeout(() => {
    syncCJTracking().catch(console.error);
    setInterval(() => syncCJTracking().catch(console.error), SIX_HOURS);
  }, 35000);
}

export function startCJPriceSyncJob(): void {
  console.log("💰 CJ Dropshipping price/stock sync started (every 24 hours)");
  setTimeout(() => {
    syncCJPricesAndStock().catch(console.error);
    setInterval(() => syncCJPricesAndStock().catch(console.error), TWENTY_FOUR_HOURS);
  }, 65000);
}
