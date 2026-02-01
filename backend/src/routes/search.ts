import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";

const router = Router();

// GET /api/search
router.get("/", async (req: Request, res: Response) => {
  try {
    const {
      q,
      category,
      minPrice,
      maxPrice,
      minRating,
      inStock,
      sort = "relevance",
      page = "1",
      limit = "20",
    } = req.query;

    if (!q || typeof q !== "string" || q.length < 2) {
      return res.status(400).json({ error: "Search query must be at least 2 characters" });
    }

    const take = Math.min(parseInt(limit as string) || 20, 50);
    const skip = (Math.max(parseInt(page as string) || 1, 1) - 1) * take;

    // Build where clause
    const where: any = {
      status: "ACTIVE",
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { tags: { hasSome: [q.toLowerCase()] } },
      ],
    };

    if (category) {
      where.category = { slug: category };
    }

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice as string);
      if (maxPrice) where.price.lte = parseFloat(maxPrice as string);
    }

    if (minRating) {
      where.rating = { gte: parseFloat(minRating as string) };
    }

    if (inStock === "true") {
      where.stock = { gt: 0 };
    }

    // Sort order
    let orderBy: any = {};
    switch (sort) {
      case "price_asc":
        orderBy = { price: "asc" };
        break;
      case "price_desc":
        orderBy = { price: "desc" };
        break;
      case "rating":
        orderBy = { rating: "desc" };
        break;
      case "newest":
        orderBy = { createdAt: "desc" };
        break;
      case "popular":
        orderBy = { reviewCount: "desc" };
        break;
      default:
        orderBy = { rating: "desc" }; // Relevance approximation
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        take,
        skip,
        include: {
          category: { select: { name: true, slug: true } },
          images: { take: 1, orderBy: { position: "asc" } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    // Get facets for filters
    const [categoryFacets, priceStats] = await Promise.all([
      prisma.product.groupBy({
        by: ["categoryId"],
        where: { status: "ACTIVE" },
        _count: { categoryId: true },
      }),
      prisma.product.aggregate({
        where: { status: "ACTIVE" },
        _min: { price: true },
        _max: { price: true },
      }),
    ]);

    return res.json({
      query: q,
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: p.price,
        comparePrice: p.comparePrice,
        currency: p.currency,
        rating: p.rating,
        reviewCount: p.reviewCount,
        imageUrl: p.images[0]?.url || null,
        category: p.category,
        inStock: p.stock > 0,
      })),
      facets: {
        priceRange: {
          min: priceStats._min.price || 0,
          max: priceStats._max.price || 0,
        },
      },
      pagination: {
        total,
        page: Math.floor(skip / take) + 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error("Search error:", error);
    return res.status(500).json({ error: "Search failed" });
  }
});

// GET /api/search/suggestions
router.get("/suggestions", async (req: Request, res: Response) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== "string" || q.length < 2) {
      return res.json({ suggestions: [] });
    }

    const products = await prisma.product.findMany({
      where: {
        status: "ACTIVE",
        name: { contains: q, mode: "insensitive" },
      },
      select: { name: true, slug: true },
      take: 8,
    });

    const categories = await prisma.category.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      select: { name: true, slug: true },
      take: 4,
    });

    return res.json({
      suggestions: {
        products: products.map((p) => ({ name: p.name, slug: p.slug, type: "product" })),
        categories: categories.map((c) => ({ name: c.name, slug: c.slug, type: "category" })),
      },
    });
  } catch (error) {
    console.error("Suggestions error:", error);
    return res.status(500).json({ error: "Failed to get suggestions" });
  }
});

export default router;
