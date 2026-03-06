/**
 * AliExpress Order Placement Service
 * Handles auto-placing dropshipping orders after payment confirmation
 */

import prisma from "../lib/prisma";
import { placeOrder } from "./aliexpress";

/**
 * Parse a shipping address string into structured fields.
 * Address format is flexible — we extract what we can.
 */
function parseShippingAddress(addressStr: string, customerName: string, phone?: string | null) {
  // Try to split by common delimiters
  const parts = addressStr.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);

  return {
    name: customerName,
    phone: phone || "",
    street: parts[0] || addressStr,
    city: parts[1] || "",
    province: parts[2] || "",
    country: parts[3] || "UG",
    zip: parts[4] || "",
  };
}

/**
 * Place AliExpress orders for all dropshipped items in a confirmed order.
 * Called asynchronously after payment confirmation.
 */
export async function placeAliExpressOrdersForOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              aliexpressProductId: true,
              aliexpressCost: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    console.error(`[AE-Order] Order ${orderId} not found`);
    return;
  }

  // Filter to only AliExpress-sourced items
  const aeItems = order.items.filter((item) => item.product.aliexpressProductId);

  if (aeItems.length === 0) {
    // No AliExpress products — this is a regular order with own products
    return;
  }

  const address = parseShippingAddress(order.shippingAddress, order.customerName, order.customerPhone);

  for (const item of aeItems) {
    try {
      // Create a pending AliExpress order record
      const aeOrder = await prisma.aliExpressOrder.create({
        data: {
          orderId: order.id,
          productId: item.product.id,
          aliexpressProductId: item.product.aliexpressProductId!,
          quantity: item.quantity,
          supplierCost: item.product.aliexpressCost || item.price,
          status: "PENDING",
        },
      });

      // Place the order on AliExpress
      const result = await placeOrder({
        productId: item.product.aliexpressProductId!,
        quantity: item.quantity,
        shippingAddress: address,
      });

      // Update with the AliExpress order ID
      await prisma.aliExpressOrder.update({
        where: { id: aeOrder.id },
        data: {
          aliexpressOrderId: result.aliexpressOrderId,
          status: "PLACED",
          placedAt: new Date(),
        },
      });

      // Add order event
      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          status: "PROCESSING",
          note: `Supplier order placed for "${item.product.name}" (AE #${result.aliexpressOrderId})`,
        },
      });

      console.log(`✅ [AE-Order] Placed AE order ${result.aliexpressOrderId} for product ${item.product.name}`);
    } catch (error: any) {
      console.error(`❌ [AE-Order] Failed to place AE order for ${item.product.name}:`, error.message);

      // Record the failure
      await prisma.aliExpressOrder.updateMany({
        where: {
          orderId: order.id,
          productId: item.product.id,
          status: "PENDING",
        },
        data: {
          status: "FAILED",
          errorMessage: error.message,
        },
      });

      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          status: "PROCESSING",
          note: `⚠️ Supplier order failed for "${item.product.name}": ${error.message}`,
        },
      });
    }
  }

  // Update order to PROCESSING if at least one AE order was placed
  const placedCount = await prisma.aliExpressOrder.count({
    where: { orderId: order.id, status: "PLACED" },
  });

  if (placedCount > 0) {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "PROCESSING" },
    });
  }
}
