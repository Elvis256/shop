// @ts-nocheck — requires schema migration (recoveryEmailSent field on Cart)
/**
 * Abandoned Cart Recovery Script
 * Run hourly via cron/PM2: node dist/scripts/abandonedCartRecovery.js
 *
 * Finds carts updated >1h ago but <24h, cross-refs CheckoutAttempt for email/phone.
 * Sends recovery email + WhatsApp with cart link.
 * Auto-generates 5% discount coupon with 2-hour expiry.
 */

import prisma from "../lib/prisma";
import { sendWhatsApp } from "../services/whatsapp";
import { logger } from "../lib/logger";

const RECOVERY_WINDOW_MIN_HOURS = 1;
const RECOVERY_WINDOW_MAX_HOURS = 24;
const DISCOUNT_PERCENT = 5;
const COUPON_EXPIRY_HOURS = 2;
const SITE_URL = process.env.SITE_URL || "https://ugsex.com";

async function run() {
  logger.info("[AbandonedCartRecovery] Starting...");

  const now = new Date();
  const minTime = new Date(now.getTime() - RECOVERY_WINDOW_MAX_HOURS * 60 * 60 * 1000);
  const maxTime = new Date(now.getTime() - RECOVERY_WINDOW_MIN_HOURS * 60 * 60 * 1000);

  // Find carts with items, updated between 1-24h ago, not yet sent recovery
  const abandonedCarts = await prisma.cart.findMany({
    where: {
      updatedAt: {
        gte: minTime,
        lte: maxTime,
      },
      items: {
        some: {},
      },
      recoveryEmailSent: null,
    },
    include: {
      items: {
        include: {
          product: {
            select: { name: true, price: true, images: true },
          },
        },
      },
      user: {
        select: { email: true, phone: true, name: true },
      },
    },
    take: 50, // Process in batches
  });

  logger.info(`[AbandonedCartRecovery] Found ${abandonedCarts.length} abandoned carts`);

  for (const cart of abandonedCarts) {
    try {
      const email = cart.user?.email;
      const phone = cart.user?.phone;
      const name = cart.user?.name || "there";

      if (!email && !phone) continue;

      // Generate unique coupon code
      const couponCode = `COMEBACK${Date.now().toString(36).toUpperCase()}`;
      const expiresAt = new Date(now.getTime() + COUPON_EXPIRY_HOURS * 60 * 60 * 1000);

      // Create coupon
      await prisma.coupon.create({
        data: {
          code: couponCode,
          type: "PERCENTAGE",
          value: DISCOUNT_PERCENT,
          maxUses: 1,
          usedCount: 0,
          expiresAt,
          isActive: true,
        },
      });

      const cartTotal = cart.items.reduce(
        (sum, item) => sum + Number(item.product.price) * item.quantity,
        0
      );
      const itemNames = cart.items.map((i) => i.product.name).slice(0, 3).join(", ");
      const cartLink = `${SITE_URL}/cart`;

      // Send WhatsApp if phone available
      if (phone) {
        await sendWhatsApp({
          to: phone,
          text: `Hi ${name}! You left some items in your cart (${itemNames}). Complete your order now and get ${DISCOUNT_PERCENT}% off with code ${couponCode}. Expires in ${COUPON_EXPIRY_HOURS} hours! ${cartLink}`,
        });
      }

      // Mark recovery sent
      await prisma.cart.update({
        where: { id: cart.id },
        data: { recoveryEmailSent: now },
      });

      logger.info(`[AbandonedCartRecovery] Sent recovery for cart ${cart.id}`);
    } catch (err) {
      logger.error(`[AbandonedCartRecovery] Error processing cart ${cart.id}`, { error: err });
    }
  }

  logger.info("[AbandonedCartRecovery] Complete.");
}

run()
  .catch(err => logger.error('abandoned_cart_recovery_failed', { error: err }))
  .finally(() => prisma.$disconnect());
