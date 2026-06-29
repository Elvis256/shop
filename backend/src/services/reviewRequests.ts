import prisma from "../lib/prisma";
import { sendEmail } from "../lib/email";
import { sendPushToUser } from "./push";
import { logger } from "../lib/logger";

/**
 * Auto Review Request Job
 * Finds delivered orders (3+ days ago) where no review exists
 * and sends an email + push notification requesting a review.
 */
export async function checkAndSendReviewRequests(): Promise<void> {
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    // Find delivered orders with delivery timeline events older than 3 days
    const deliveredOrders = await prisma.order.findMany({
      where: {
        status: "DELIVERED",
        userId: { not: null },
        timeline: {
          some: {
            status: "DELIVERED",
            createdAt: { lt: threeDaysAgo },
          },
        },
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, slug: true } },
          },
        },
        user: { select: { id: true, email: true, name: true } },
      },
    });

    let sent = 0;
    for (const order of deliveredOrders) {
      if (!order.user) continue;

      // Check if we already sent a review request (tracked via Setting)
      const settingKey = `review_requested_${order.id}`;
      const alreadySent = await prisma.setting.findUnique({ where: { key: settingKey } });
      if (alreadySent) continue;

      // Check if user has already reviewed any item from this order
      const existingReviews = await prisma.review.findMany({
        where: {
          userId: order.user.id,
          productId: { in: order.items.map((i) => i.productId) },
        },
      });

      if (existingReviews.length > 0) {
        // Mark as handled so we don't check again
        await prisma.setting.create({
          data: { key: settingKey, value: "has_reviews" },
        });
        continue;
      }

      // Calculate days since delivery
      const deliveryEvent = await prisma.orderEvent.findFirst({
        where: { orderId: order.id, status: "DELIVERED" },
        orderBy: { createdAt: "desc" },
      });
      const daysAgo = deliveryEvent
        ? Math.floor((Date.now() - deliveryEvent.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : 3;

      // Send review request email using the dedicated template
      try {
        await sendEmail({
          to: order.user.email,
          template: "review-prompt",
          data: {
            name: order.user.name || order.customerName,
            orderNumber: order.orderNumber,
            orderId: order.id,
            daysAgo,
            items: order.items.map((i) => ({
              name: i.product.name,
              slug: i.product.slug,
            })),
          },
        });
      } catch (emailErr) {
        logger.error(`Failed to send review request email for order ${order.orderNumber}`, { error: emailErr });
      }

      // Send push notification
      try {
        await sendPushToUser(order.user.id, {
          title: "How was your order?",
          body: `Your order #${order.orderNumber} was delivered ${daysAgo} days ago. Leave a review!`,
          url: `/account/orders/${order.id}`,
        });
      } catch (pushErr) {
        logger.warn("Failed to send review push", { error: (pushErr as any).message });
      }

      // Track that we sent the request
      await prisma.setting.create({
        data: { key: settingKey, value: new Date().toISOString() },
      });
      sent++;
    }

    if (sent > 0) {
      logger.info("review_requests_sent", { count: sent });
    }
  } catch (error) {
    logger.error("Review request job error", { error });
  }
}

/**
 * Start the review request job — runs every 6 hours.
 */
export function startReviewRequestJob(): void {
  const SIX_HOURS = 6 * 60 * 60 * 1000;

  // Run after a 2 minute initial delay
  setTimeout(() => {
    checkAndSendReviewRequests().catch(err => logger.error('review_requests_failed', { error: err }));
    setInterval(() => {
      checkAndSendReviewRequests().catch(err => logger.error('review_requests_failed', { error: err }));
    }, SIX_HOURS);
  }, 2 * 60 * 1000);

  logger.info("Review request job scheduled (every 6 hours)");
}
