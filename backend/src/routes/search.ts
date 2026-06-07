import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { trackSearch, getPopularSearches, cacheGetOrSet, SHORT_TTL } from "../lib/cache";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

// GET /api/search — Uses PostgreSQL full-text search (GIN index) for scalability
router.get("/", asyncHandler(async (req: Request, res: Response) => {
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
    const pageNum = Math.max(parseInt(page as string) || 1, 1);
    const skip = (pageNum - 1) * take;

    // Build the tsquery from search terms: "vibrator toy" → "vibrator | toy"
    const words = q.trim().split(/\s+/).filter((w) => w.length >= 2);
    const tsQuery = words.map(w => w.replace(/[^a-zA-Z0-9]/g, '')).filter(Boolean).join(" | ");

    // Build SQL filter conditions
    const conditions: string[] = [`p.status = 'ACTIVE'`];
    const params: any[] = [];

    // Full-text search condition + tag matching
    if (tsQuery) {
      params.push(tsQuery);
      params.push(q.toLowerCase());
      conditions.push(`(
        to_tsvector('english', COALESCE(p.name, '') || ' ' || COALESCE(p.description, '')) @@ to_tsquery('english', $${params.length - 1})
        OR $${params.length} = ANY(p.tags)
      )`);
    }

    if (category) {
      params.push(category);
      conditions.push(`c.slug = $${params.length}`);
    }
    if (minPrice) {
      params.push(parseFloat(minPrice as string));
      conditions.push(`p.price >= $${params.length}`);
    }
    if (maxPrice) {
      params.push(parseFloat(maxPrice as string));
      conditions.push(`p.price <= $${params.length}`);
    }
    if (minRating) {
      params.push(parseFloat(minRating as string));
      conditions.push(`p.rating >= $${params.length}`);
    }
    if (inStock === "true") {
      conditions.push(`p.stock > 0`);
    }

    const whereClause = conditions.join(" AND ");

    // Sort mapping
    const sortMap: Record<string, string> = {
      price_asc: "p.price ASC",
      price_desc: "p.price DESC",
      rating: "p.rating DESC NULLS LAST",
      newest: 'p."createdAt" DESC',
      popular: 'p."reviewCount" DESC NULLS LAST',
      relevance: tsQuery
        ? `ts_rank(to_tsvector('english', COALESCE(p.name, '') || ' ' || COALESCE(p.description, '')), to_tsquery('english', $1)) DESC`
        : "p.rating DESC NULLS LAST",
    };
    const orderClause = sortMap[sort as string] || sortMap.relevance;

    // Count query
    params.push(take);
    const limitIdx = params.length;
    params.push(skip);
    const offsetIdx = params.length;

    const countSql = `SELECT COUNT(*)::int as total FROM "Product" p LEFT JOIN "Category" c ON c.id = p."categoryId" WHERE ${whereClause}`;
    const dataSql = `
      SELECT p.id, p.name, p.slug, p.price::float8 as price, p."comparePrice"::float8 as "comparePrice",
        p.currency, p.rating::float8 as rating, p."reviewCount", p.stock,
        p."cjProductId", p."aliexpressProductId",
        p."flashSalePrice"::float8 as "flashSalePrice", p."flashSaleEndsAt",
        c.name as "categoryName", c.slug as "categorySlug",
        (SELECT url FROM "ProductImage" pi WHERE pi."productId" = p.id ORDER BY pi.position ASC LIMIT 1) as "imageUrl"
      FROM "Product" p
      LEFT JOIN "Category" c ON c.id = p."categoryId"
      WHERE ${whereClause}
      ORDER BY ${orderClause}
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`;

    const [countResult, products] = await Promise.all([
      prisma.$queryRawUnsafe<[{ total: number }]>(countSql, ...params.slice(0, -2)),
      prisma.$queryRawUnsafe<any[]>(dataSql, ...params),
    ]);

    const total = countResult[0]?.total || 0;

    // Get price range stats (cached)
    const priceStats = await cacheGetOrSet("search:pricerange", () =>
      prisma.product.aggregate({
        where: { status: "ACTIVE" },
        _min: { price: true },
        _max: { price: true },
      }),
      300 // 5 min cache
    );

    // Track search query
    trackSearch(q).catch(() => {});

    // "Did you mean" for zero results
    let didYouMean: string | null = null;
    if (total === 0 && q.length > 3) {
      const truncated = q.slice(0, -1);
      const truncWords = truncated.split(/\s+/).filter(w => w.length >= 2).map(w => w.replace(/[^a-zA-Z0-9]/g, '')).filter(Boolean).join(" | ");
      if (truncWords) {
        const [alt] = await prisma.$queryRaw<[{ cnt: number }]>`
          SELECT COUNT(*)::int as cnt FROM "Product"
          WHERE status = 'ACTIVE'
            AND to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, '')) @@ to_tsquery('english', ${truncWords})`;
        if (alt?.cnt > 0) didYouMean = truncated;
      }
    }

    return res.json({
      query: q,
      didYouMean,
      products: products.map((p: any) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: p.price,
        comparePrice: p.comparePrice,
        currency: p.currency,
        rating: p.rating,
        reviewCount: p.reviewCount,
        imageUrl: p.imageUrl || null,
        category: p.categoryName || null,
        inStock: p.stock > 0,
        shippingBadge: (p.cjProductId || p.aliexpressProductId) ? "From Abroad" : "Express",
        flashSalePrice: p.flashSalePrice || null,
        flashSaleEndsAt: p.flashSaleEndsAt?.toISOString?.() || null,
      })),
      facets: {
        priceRange: {
          min: priceStats._min.price || 0,
          max: priceStats._max.price || 0,
        },
      },
      pagination: {
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    logger.error("Search error", { error });
    return res.status(500).json({ error: "Search failed" });
  }
}));

// GET /api/search/suggestions — uses full-text search for products
router.get("/suggestions", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== "string" || q.length < 1) {
      const popular = await getPopularSearches(8);
      return res.json({ suggestions: { products: [], categories: [], popular } });
    }

    // Use prefix matching for suggestions (fast with GIN index)
    const tsQuery = q.trim().split(/\s+/).filter(w => w.length >= 1)
      .map(w => w.replace(/[^a-zA-Z0-9]/g, '') + ":*").filter(Boolean).join(" & ");

    const [products, categories] = await Promise.all([
      tsQuery ? prisma.$queryRaw<any[]>`
        SELECT p.name, p.slug, p.price::float8 as price,
          (SELECT url FROM "ProductImage" pi WHERE pi."productId" = p.id ORDER BY pi.position ASC LIMIT 1) as "imageUrl"
        FROM "Product" p
        WHERE p.status = 'ACTIVE'
          AND (to_tsvector('english', COALESCE(p.name, '')) @@ to_tsquery('english', ${tsQuery})
            OR ${q.toLowerCase()} = ANY(p.tags))
        LIMIT 6` : [],
      prisma.category.findMany({
        where: { name: { contains: q, mode: "insensitive" } },
        select: { name: true, slug: true, imageUrl: true, _count: { select: { products: true } } },
        take: 4,
      }),
    ]);

    const popular = await getPopularSearches(4);

    return res.json({
      suggestions: {
        products: products.map((p: any) => ({
          name: p.name,
          slug: p.slug,
          price: p.price,
          imageUrl: p.imageUrl || null,
          type: "product",
        })),
        categories: categories.map((c) => ({
          name: c.name,
          slug: c.slug,
          imageUrl: c.imageUrl,
          productCount: c._count.products,
          type: "category",
        })),
        popular,
      },
    });
  } catch (error) {
    logger.error("Suggestions error", { error });
    return res.status(500).json({ error: "Failed to get suggestions" });
  }
}));

export default router;
