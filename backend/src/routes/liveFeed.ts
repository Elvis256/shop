import { Router } from "express";
import prisma from "../lib/prisma";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";
import { parseShippingAddress } from "../utils/shippingAddress";

const router = Router();

// GET /api/social/live-feed - Get recent purchases for social proof
router.get("/live-feed", asyncHandler(async (_req, res) => {
  try {
    const recentOrders = await prisma.orderItem.findMany({
      where: {
        order: {
          status: { in: ["PROCESSING", "SHIPPED", "DELIVERED"] },
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      },
      select: {
        product: {
          select: { name: true, slug: true, images: { select: { url: true }, take: 1 } },
        },
        order: {
          select: {
            createdAt: true,
            shippingAddress: true,
          },
        },
      },
      orderBy: { order: { createdAt: "desc" } },
      take: 20,
    });

    // Anonymize and format
    const feed = recentOrders.map((item) => {
      const addr = parseShippingAddress(item.order.shippingAddress);
      const city = addr?.city || "Uganda";

      return {
        productName: item.product?.name || "A product",
        productSlug: item.product?.slug,
        productImage: item.product?.images?.[0]?.url || null,
        city,
        timeAgo: getTimeAgo(item.order.createdAt),
      };
    });

    res.json({ feed });
  } catch (err) {
    logger.error("Live feed error", { error: err });
    // Return empty feed on error — don't fabricate data
    res.json({ feed: [] });
  }
}));

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default router;
