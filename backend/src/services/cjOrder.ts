/**
 * CJ Dropshipping Order Placement Service
 * Auto-places CJ orders after payment confirmation
 */

import prisma from "../lib/prisma";
import { placeOrder } from "./cjdropshipping";

function parseShippingAddress(addressStr: string, customerName: string, phone?: string | null) {
  const parts = addressStr.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
  return {
    name: customerName,
    phone: phone || "",
    street: parts[0] || addressStr,
    city: parts[1] || "",
    province: parts[2] || "",
    country: parts[3] || "Uganda",
    countryCode: "UG",
    zip: parts[4] || "",
  };
}

/**
 * Place CJ Dropshipping orders for all CJ-sourced items in a confirmed order.
 */
export async function placeCJOrdersForOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              cjProductId: true,
              cjCost: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    console.error(`[CJ-Order] Order ${orderId} not found`);
    return;
  }

  const cjItems = order.items.filter((item) => item.product.cjProductId);
  if (cjItems.length === 0) return;

  const address = parseShippingAddress(order.shippingAddress, order.customerName, order.customerPhone);

  for (const item of cjItems) {
    try {
      const cjOrder = await prisma.cJOrder.create({
        data: {
          orderId: order.id,
          productId: item.product.id,
          cjProductId: item.product.cjProductId!,
          quantity: item.quantity,
          supplierCost: item.product.cjCost || item.price,
          status: "PENDING",
        },
      });

      const result = await placeOrder({
        productId: item.product.cjProductId!,
        quantity: item.quantity,
        shippingAddress: address,
      });

      await prisma.cJOrder.update({
        where: { id: cjOrder.id },
        data: {
          cjOrderId: result.cjOrderId,
          status: "PLACED",
          placedAt: new Date(),
        },
      });

      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          status: "PROCESSING",
          note: `CJ order placed for "${item.product.name}" (CJ #${result.cjOrderId})`,
        },
      });

      console.log(`✅ [CJ-Order] Placed CJ order ${result.cjOrderId} for ${item.product.name}`);
    } catch (error: any) {
      console.error(`❌ [CJ-Order] Failed for ${item.product.name}:`, error.message);

      await prisma.cJOrder.updateMany({
        where: { orderId: order.id, productId: item.product.id, status: "PENDING" },
        data: { status: "FAILED", errorMessage: error.message },
      });

      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          status: "PROCESSING",
          note: `⚠️ CJ order failed for "${item.product.name}": ${error.message}`,
        },
      });
    }
  }

  const placedCount = await prisma.cJOrder.count({
    where: { orderId: order.id, status: "PLACED" },
  });

  if (placedCount > 0) {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "PROCESSING" },
    });
  }
}
