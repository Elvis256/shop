import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, optionalAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// POST /api/browse/track — Track a product view
router.post("/track", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ error: "productId is required" });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    await prisma.browseEvent.create({
      data: {
        productId,
        userId: req.user?.id || null,
      },
    });

    return res.status(201).json({ message: "Browse event tracked" });
  } catch (error) {
    console.error("Track browse event error:", error);
    return res.status(500).json({ error: "Failed to track browse event" });
  }
});

// GET /api/browse/history — Get user's browse history (last 20)
router.get("/history", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const events = await prisma.browseEvent.findMany({
      where: { userId },
      orderBy: { viewedAt: "desc" },
      take: 20,
      distinct: ["productId"],
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            currency: true,
            images: { take: 1, orderBy: { position: "asc" } },
            category: { select: { name: true, slug: true } },
          },
        },
      },
    });

    return res.json({
      history: events.map((e) => ({
        productId: e.productId,
        viewedAt: e.viewedAt,
        product: {
          ...e.product,
          imageUrl: e.product.images[0]?.url || null,
        },
      })),
    });
  } catch (error) {
    console.error("Get browse history error:", error);
    return res.status(500).json({ error: "Failed to fetch browse history" });
  }
});

// GET /api/browse/personalized — Personalized product recommendations
router.get("/personalized", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      // Not authenticated: return popular/featured products
      const products = await prisma.product.findMany({
        where: { status: "ACTIVE" },
        orderBy: { reviewCount: "desc" },
        take: 10,
        include: {
          images: { take: 1, orderBy: { position: "asc" } },
          category: { select: { name: true, slug: true } },
        },
      });

      return res.json({
        products: products.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: p.price,
          currency: p.currency,
          rating: p.rating,
          imageUrl: p.images[0]?.url || null,
          category: p.category?.name || null,
        })),
        source: "popular",
      });
    }

    // Get user's most browsed categories
    const browseEvents = await prisma.browseEvent.findMany({
      where: { userId },
      include: { product: { select: { categoryId: true } } },
      orderBy: { viewedAt: "desc" },
      take: 50,
    });

    const categoryCounts = new Map<string, number>();
    for (const event of browseEvents) {
      const catId = event.product.categoryId;
      if (catId) {
        categoryCounts.set(catId, (categoryCounts.get(catId) || 0) + 1);
      }
    }

    // Sort categories by browse count
    const topCategories = Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => id);

    // Get recently viewed product IDs to exclude
    const viewedProductIds = [...new Set(browseEvents.map((e) => e.productId))];

    const whereClause: any = {
      status: "ACTIVE" as const,
      id: { notIn: viewedProductIds.slice(0, 20) },
    };
    if (topCategories.length > 0) {
      whereClause.categoryId = { in: topCategories };
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      orderBy: { rating: "desc" },
      take: 10,
      include: {
        images: { take: 1, orderBy: { position: "asc" } },
        category: { select: { name: true, slug: true } },
      },
    });

    return res.json({
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: p.price,
        currency: p.currency,
        rating: p.rating,
        imageUrl: p.images[0]?.url || null,
        category: p.category?.name || null,
      })),
      source: "personalized",
    });
  } catch (error) {
    console.error("Get personalized recommendations error:", error);
    return res.status(500).json({ error: "Failed to fetch recommendations" });
  }
});

export default router;
