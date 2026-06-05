import prisma from "../lib/prisma";
import { logger } from "../lib/logger";

/**
 * Ad billing job: runs hourly.
 * 1. Expire promotions past endDate
 * 2. Update spent for active promotions based on elapsed days × dailyRate
 */
export async function processAdBilling() {
  const now = new Date();

  // 1. Expire promotions past endDate
  const expired = await prisma.productPromotion.updateMany({
    where: {
      status: "ACTIVE",
      endDate: { lt: now },
    },
    data: { status: "EXPIRED" },
  });

  if (expired.count > 0) {
    logger.info(`[AdBilling] Expired ${expired.count} promotions`);
  }

  // 2. Update spent for active promotions
  const activePromos = await prisma.productPromotion.findMany({
    where: { status: "ACTIVE" },
  });

  for (const promo of activePromos) {
    const elapsedMs = now.getTime() - promo.startDate.getTime();
    const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
    const calculatedSpent = Math.min(
      elapsedDays * Number(promo.dailyRate),
      Number(promo.totalBudget)
    );

    if (Math.abs(calculatedSpent - Number(promo.spent)) > 1) {
      await prisma.productPromotion.update({
        where: { id: promo.id },
        data: { spent: Math.round(calculatedSpent) },
      });
    }
  }
}

/**
 * Background job: runs processAdBilling() every hour.
 */
export function startAdBillingJob() {
  const INTERVAL = 60 * 60 * 1000; // 1 hour

  // Run once after 60s
  setTimeout(() => {
    processAdBilling().catch((err) =>
      logger.error("[AdBilling] Processing failed", { error: err })
    );
  }, 60_000);

  // Then every hour
  setInterval(() => {
    processAdBilling().catch((err) =>
      logger.error("[AdBilling] Processing failed", { error: err })
    );
  }, INTERVAL);

  logger.info("[AdBilling] Job scheduled (every 1h)");
}
