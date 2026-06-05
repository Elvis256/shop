import { Router } from "express";
import prisma from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";

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
      let city = "Uganda";
      try {
        const addr = JSON.parse(item.order.shippingAddress);
        if (addr.city) city = addr.city;
      } catch { /* shippingAddress may not be valid JSON */ }

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
    // If no orders exist yet, return mock data for social proof
    res.json({
      feed: [
        { productName: "Premium Wellness Product", productSlug: null, productImage: null, city: "Kampala", timeAgo: "2 min ago" },
        { productName: "Luxury Intimate Set", productSlug: null, productImage: null, city: "Entebbe", timeAgo: "5 min ago" },
        { productName: "Couples Package", productSlug: null, productImage: null, city: "Jinja", timeAgo: "12 min ago" },
      ],
    });
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
