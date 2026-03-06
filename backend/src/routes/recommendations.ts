import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { cacheGetOrSet, getTrendingIds, trackTrending, trackViewer, getViewerCount, LONG_TTL, SHORT_TTL } from "../lib/cache";

const router = Router();

// GET /api/recommendations/trending - Hot products based on sales velocity
router.get("/trending", async (_req: Request, res: Response) => {
  try {
    const data = await cacheGetOrSet("reco:trending", async () => {
      // First try Redis trending scores (real-time)
      const trendingIds = await getTrendingIds(12);
      if (trendingIds.length >= 4) {
        const products = await prisma.product.findMany({
          where: { id: { in: trendingIds }, status: "ACTIVE" },
          include: { images: { take: 1, orderBy: { position: "asc" } }, category: { select: { name: true } } },
        });
        // Preserve trending order
        const ordered = trendingIds
          .map((id) => products.find((p) => p.id === id))
          .filter(Boolean);
        return ordered.map(formatProduct);
      }

      // Fallback: products with most recent orders
      const recent = await prisma.orderItem.groupBy({
        by: ["productId"],
        where: { order: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) }, paymentStatus: "SUCCESSFUL" } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 12,
      });
      const products = await prisma.product.findMany({
        where: { id: { in: recent.map((r) => r.productId) }, status: "ACTIVE" },
        include: { images: { take: 1, orderBy: { position: "asc" } }, category: { select: { name: true } } },
      });
      const idOrder = recent.map((r) => r.productId);
      return idOrder
        .map((id) => products.find((p) => p.id === id))
        .filter(Boolean)
        .map((p) => ({ ...formatProduct(p!), soldRecently: recent.find((r) => r.productId === p!.id)?._sum.quantity || 0 }));
    }, SHORT_TTL);

    return res.json({ products: data });
  } catch (error) {
    console.error("Trending error:", error);
    return res.status(500).json({ error: "Failed to load trending" });
  }
});

// GET /api/recommendations/bought-together/:productId
router.get("/bought-together/:productId", async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const data = await cacheGetOrSet(`reco:together:${productId}`, async () => {
      // Find orders containing this product, then find other products in those orders
      const orderIds = await prisma.orderItem.findMany({
        where: { productId },
        select: { orderId: true },
        take: 100,
      });
      if (orderIds.length === 0) return [];

      const coItems = await prisma.orderItem.groupBy({
        by: ["productId"],
        where: {
          orderId: { in: orderIds.map((o) => o.orderId) },
          productId: { not: productId },
        },
        _count: { productId: true },
        orderBy: { _count: { productId: "desc" } },
        take: 6,
      });

      const products = await prisma.product.findMany({
        where: { id: { in: coItems.map((c) => c.productId) }, status: "ACTIVE" },
        include: { images: { take: 1, orderBy: { position: "asc" } }, category: { select: { name: true } } },
      });

      return coItems
        .map((c) => products.find((p) => p.id === c.productId))
        .filter(Boolean)
        .map(formatProduct);
    }, LONG_TTL);

    return res.json({ products: data });
  } catch (error) {
    console.error("Bought-together error:", error);
    return res.status(500).json({ error: "Failed to load recommendations" });
  }
});

// GET /api/recommendations/similar/:productId
router.get("/similar/:productId", async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const data = await cacheGetOrSet(`reco:similar:${productId}`, async () => {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { categoryId: true, price: true, tags: true },
      });
      if (!product) return [];

      const priceRange = Number(product.price) * 0.5;
      const products = await prisma.product.findMany({
        where: {
          id: { not: productId },
          status: "ACTIVE",
          categoryId: product.categoryId,
          price: { gte: Number(product.price) - priceRange, lte: Number(product.price) + priceRange },
        },
        include: { images: { take: 1, orderBy: { position: "asc" } }, category: { select: { name: true } } },
        take: 8,
        orderBy: { rating: "desc" },
      });

      return products.map(formatProduct);
    }, LONG_TTL);

    return res.json({ products: data });
  } catch (error) {
    console.error("Similar error:", error);
    return res.status(500).json({ error: "Failed to load similar products" });
  }
});

// GET /api/recommendations/new-arrivals
router.get("/new-arrivals", async (_req: Request, res: Response) => {
  try {
    const data = await cacheGetOrSet("reco:new-arrivals", async () => {
      const products = await prisma.product.findMany({
        where: { status: "ACTIVE" },
        include: { images: { take: 1, orderBy: { position: "asc" } }, category: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 12,
      });
      return products.map(formatProduct);
    }, SHORT_TTL);

    return res.json({ products: data });
  } catch (error) {
    console.error("New arrivals error:", error);
    return res.status(500).json({ error: "Failed to load new arrivals" });
  }
});

// GET /api/recommendations/top-rated
router.get("/top-rated", async (_req: Request, res: Response) => {
  try {
    const data = await cacheGetOrSet("reco:top-rated", async () => {
      const products = await prisma.product.findMany({
        where: { status: "ACTIVE", rating: { gte: 4.0 }, reviewCount: { gte: 1 } },
        include: { images: { take: 1, orderBy: { position: "asc" } }, category: { select: { name: true } } },
        orderBy: [{ rating: "desc" }, { reviewCount: "desc" }],
        take: 12,
      });
      return products.map(formatProduct);
    }, SHORT_TTL);

    return res.json({ products: data });
  } catch (error) {
    console.error("Top rated error:", error);
    return res.status(500).json({ error: "Failed to load top rated" });
  }
});

// POST /api/recommendations/track-view - Track product view for trending & viewer count
router.post("/track-view", async (req: Request, res: Response) => {
  try {
    const { productId, sessionId } = req.body;
    if (!productId) return res.status(400).json({ error: "productId required" });

    const sid = sessionId || req.ip || "anon";
    const [viewerCount] = await Promise.all([
      trackViewer(productId, sid),
      trackTrending(productId, 1),
    ]);

    return res.json({ viewerCount });
  } catch {
    return res.json({ viewerCount: 0 });
  }
});

// GET /api/recommendations/viewers/:productId
router.get("/viewers/:productId", async (req: Request, res: Response) => {
  try {
    const count = await getViewerCount(req.params.productId);
    return res.json({ viewerCount: count });
  } catch {
    return res.json({ viewerCount: 0 });
  }
});

function formatProduct(p: any) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: Number(p.price),
    compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
    imageUrl: p.images?.[0]?.url || null,
    category: p.category?.name || null,
    rating: p.rating ? Number(p.rating) : null,
    reviewCount: p.reviewCount || 0,
    stock: p.stock,
    isNew: p.createdAt > new Date(Date.now() - 14 * 86400000),
    shippingBadge: (p.cjProductId || p.aliexpressProductId) ? "From Abroad" : "Express",
  };
}

export default router;
