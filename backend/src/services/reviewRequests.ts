import prisma from "../lib/prisma";
import { sendEmail } from "../lib/email";

/**
 * Auto Review Request Job
 * Finds delivered orders (3+ days ago) where no review exists
 * and sends an email requesting a review.
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

      // Send review request email
      try {
        await sendEmail({
          to: order.user.email,
          template: "order-delivered",
          data: {
            customerName: order.user.name || order.customerName,
            orderNumber: order.orderNumber,
            items: order.items.map((i) => ({
              name: i.product.name,
              slug: i.product.slug,
            })),
          },
        });
      } catch (emailErr) {
        console.error(`Failed to send review request email for order ${order.orderNumber}:`, emailErr);
      }

      // Track that we sent the request
      await prisma.setting.create({
        data: { key: settingKey, value: new Date().toISOString() },
      });
    }
  } catch (error) {
    console.error("Review request job error:", error);
  }
}

/**
 * Start the review request job — runs every 6 hours.
 */
export function startReviewRequestJob(): void {
  const SIX_HOURS = 6 * 60 * 60 * 1000;

  // Run after a 2 minute initial delay
  setTimeout(() => {
    checkAndSendReviewRequests().catch(console.error);
    setInterval(() => {
      checkAndSendReviewRequests().catch(console.error);
    }, SIX_HOURS);
  }, 2 * 60 * 1000);

  console.log("📧 Review request job scheduled (every 6 hours)");
}
