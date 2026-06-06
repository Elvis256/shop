import prisma from "../lib/prisma";
import { sendWhatsApp } from "../services/whatsapp";
import { sendSMS } from "../services/sms";
import { logger } from "../lib/logger";
import { generateReorderToken } from "../routes/quickReorder";

const BASE_URL = process.env.FRONTEND_URL || "https://ugsex.com";

/**
 * Smart Reorder Reminders:
 * Tracks per-user purchase intervals and sends "time to restock?" nudges
 * when the user is likely running low on a previously purchased consumable.
 */
export async function processSmartReorderReminders(): Promise<number> {
  let sent = 0;

  try {
    // Find users with 2+ purchases of the same product (delivered orders)
    const repeatPurchases = await prisma.$queryRaw<Array<{
      userId: string;
      productId: string;
      productName: string;
      productSlug: string;
      purchaseCount: number;
      avgIntervalDays: number;
      lastPurchaseDate: Date;
      userPhone: string | null;
    }>>`
      SELECT
        o."userId",
        oi."productId",
        p."name" as "productName",
        p."slug" as "productSlug",
        COUNT(*)::int as "purchaseCount",
        EXTRACT(EPOCH FROM (MAX(o."createdAt") - MIN(o."createdAt"))) / NULLIF(COUNT(*) - 1, 0) / 86400 as "avgIntervalDays",
        MAX(o."createdAt") as "lastPurchaseDate",
        u."phone" as "userPhone"
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      JOIN "Product" p ON p."id" = oi."productId"
      JOIN "User" u ON u."id" = o."userId"
      WHERE o."status" = 'DELIVERED'
        AND o."userId" IS NOT NULL
      GROUP BY o."userId", oi."productId", p."name", p."slug", u."phone"
      HAVING COUNT(*) >= 2
    `;

    for (const row of repeatPurchases) {
      if (!row.avgIntervalDays || row.avgIntervalDays < 7) continue;
      if (!row.userPhone) continue;

      const daysSinceLastPurchase = Math.floor(
        (Date.now() - new Date(row.lastPurchaseDate).getTime()) / (1000 * 60 * 60 * 24)
      );

      const daysUntilReorder = Math.round(row.avgIntervalDays) - daysSinceLastPurchase;

      // Send reminder if within 3 days of expected reorder
      if (daysUntilReorder > 3 || daysUntilReorder < -7) continue;

      // Skip if user has an active subscription for this product
      const activeSub = await prisma.subscription.findFirst({
        where: {
          userId: row.userId,
          productId: row.productId,
          status: "ACTIVE",
        },
      });
      if (activeSub) continue;

      let reorderUrl = `${BASE_URL}/cart?reorder=${row.productId}:1`;

      // Try to generate a quick-reorder deep link
      const token = await generateReorderToken(row.userId, row.productId);
      if (token) {
        reorderUrl = `${BASE_URL}/reorder/${token}`;
      }

      const message = `Time to restock ${row.productName}? Based on your purchase history, you might be running low. Quick reorder: ${reorderUrl}`;

      try {
        await sendWhatsApp({ to: row.userPhone, text: message });
        sent++;
      } catch {
        try {
          await sendSMS(row.userPhone, message);
          sent++;
        } catch {}
      }
    }
  } catch (error) {
    logger.error("Smart reorder reminders error", { error });
  }

  return sent;
}

export function startSmartReorderJob(): void {
  // Run daily at 10am
  const runJob = async () => {
    const count = await processSmartReorderReminders();
    if (count > 0) {
      logger.info(`[SmartReorder] Sent ${count} reorder reminders`);
    }
  };

  // Run once after 60s, then every 24h
  setTimeout(runJob, 60_000);
  setInterval(runJob, 24 * 60 * 60 * 1000);
}
