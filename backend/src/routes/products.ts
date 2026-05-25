import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { cacheGetOrSet, cacheGet, cacheDel, cacheSet, trackTrending, SHORT_TTL, LONG_TTL } from "../lib/cache";

const router = Router();

// GET /api/products
router.get("/", async (req: Request, res: Response) => {
  try {
    const { category, minPrice, maxPrice, sort, sortBy, sortOrder, status, limit = "20", page = "1", flashSale, search } = req.query;

    const take = Math.min(parseInt(limit as string, 10) || 20, 100);
    const pageNum = Math.max(parseInt(page as string, 10) || 1, 1);
    const skip = (pageNum - 1) * take;

    // Build cache key with time partitioning for flash sales
    // Use hourly granularity: products:flash-sale:{HOUR_TIMESTAMP}
    // This ensures cache expires within 1 hour of sale end
    let cacheKey: string | null = null;
    if (flashSale === "true" && !category && !minPrice && !maxPrice && !search && pageNum === 1) {
      // Only cache full flash sale listing (no filters, first page)
      const now = new Date();
      const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
      cacheKey = `products:flash-sale:${hourStart.getTime()}`;

      // Check cache first (fast path for flash sales)
      const cached = await cacheGet<any>(cacheKey);
      if (cached) {
        // Validate cached results: ensure flashSaleEndsAt is still in future
        // (prevents showing expired sales if cache somehow persists beyond hour boundary)
        const now = new Date();
        const allSalesActive = cached.products?.every((p: any) => {
          if (!p.flashSaleEndsAt) return false;
          return new Date(p.flashSaleEndsAt) > now;
        });
        if (allSalesActive) {
          return res.json(cached);
        }
        // Sales expired — proceed to fetch fresh
      }
    }

    const where: any = {};

    if (category) {
      where.category = { slug: category };
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (flashSale === "true") {
      where.flashSalePrice = { not: null };
      where.flashSaleEndsAt = { gt: new Date() };
    }

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) {
        const min = parseFloat(minPrice as string);
        if (!isNaN(min) && min >= 0) where.price.gte = min;
      }
      if (maxPrice) {
        const max = parseFloat(maxPrice as string);
        if (!isNaN(max) && max >= 0) where.price.lte = max;
      }
    }

    let orderBy: any = {};
    
    // Support for sortBy + sortOrder parameters
    if (sortBy) {
      const field = sortBy as string;
      const order = sortOrder === "asc" ? "asc" : "desc";
      if (["price", "rating", "createdAt", "name"].includes(field)) {
        orderBy[field] = order;
      } else {
        orderBy.createdAt = "desc";
      }
    } else {
      // Legacy sort parameter support
      switch (sort) {
        case "price_asc":
          orderBy.price = "asc";
          break;
        case "price_desc":
          orderBy.price = "desc";
          break;
        case "rating":
          orderBy.rating = "desc";
          break;
        case "newest":
          orderBy.createdAt = "desc";
          break;
        case "bestseller":
        case "popular":
          orderBy = { orderItems: { _count: "desc" } };
          break;
        default:
          orderBy.createdAt = "desc";
      }
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        take,
        skip,
        include: {
          category: { select: { name: true, slug: true } },
          images: { take: 1, orderBy: { position: 'asc' } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    const responseBody = {
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: p.price,
        comparePrice: p.comparePrice,
        currency: p.currency,
        rating: p.rating,
        imageUrl: p.images[0]?.url || null,
        category: p.category?.name,
        inStock: p.stock > 0,
        stock: p.stock,
        isNew: p.isNew,
        isBestseller: p.isBestseller,
        badgeText: p.badgeText,
        shippingBadge: (p.cjProductId || p.aliexpressProductId) ? "From Abroad" : "Express",
        flashSalePrice: p.flashSalePrice ? Number(p.flashSalePrice) : null,
        flashSaleEndsAt: p.flashSaleEndsAt?.toISOString() || null,
        createdAt: p.createdAt.toISOString(),
      })),
      pagination: {
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };

    // Cache flash sale results with hourly time partitioning
    // Ensures cache auto-expires within 1 hour of sale end
    if (cacheKey) {
      await cacheSet(cacheKey, responseBody, 3600); // 1 hour TTL
    }

    return res.json(responseBody);
  } catch (error) {
    console.error("Get products error:", error);
    return res.status(500).json({ error: "Failed to fetch products" });
  }
});

// GET /api/products/:slug
router.get("/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const product = await cacheGetOrSet(`product:${slug}`, async () => {
      const p = await prisma.product.findUnique({
        where: { slug },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          images: { orderBy: { position: 'asc' } },
          variants: true,
        },
      });
      if (!p) return null;

      const now = new Date();
      const flashActive = p.flashSalePrice && p.flashSaleEndsAt && p.flashSaleEndsAt > now;

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: p.price,
        comparePrice: p.comparePrice,
        currency: p.currency,
        rating: p.rating,
        reviewCount: p.reviewCount,
        imageUrl: p.images[0]?.url || null,
        images: p.images.map(img => img.url),
        category: p.category,
        inStock: p.stock > 0,
        stock: p.stock,
        lowStockAlert: p.lowStockAlert,
        isNew: p.isNew,
        isBestseller: p.isBestseller,
        badgeText: p.badgeText,
        shippingBadge: (p.cjProductId || p.aliexpressProductId) ? "From Abroad" : "Express",
        hasVariants: p.hasVariants,
        variants: p.variants,
        weight: p.weight ? Number(p.weight) : null,
        specifications: p.specifications,
        tags: p.tags,
        flashSalePrice: flashActive ? Number(p.flashSalePrice) : null,
        flashSaleEndsAt: flashActive ? p.flashSaleEndsAt!.toISOString() : null,
        averageRating: p.rating,
        sku: p.sku,
        status: p.status,
      };
    }, LONG_TTL);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    return res.json(product);
  } catch (error) {
    console.error("Get product error:", error);
    return res.status(500).json({ error: "Failed to fetch product" });
  }
});

// GET /api/products/:slug/related
router.get("/:slug/related", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { limit = "4" } = req.query;

    // Get the current product to find its category
    const product = await prisma.product.findUnique({
      where: { slug },
      select: { id: true, categoryId: true, tags: true },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Find related products from same category, excluding current product
    const relatedProducts = await prisma.product.findMany({
      where: {
        id: { not: product.id },
        status: "ACTIVE",
        OR: [
          { categoryId: product.categoryId },
          { tags: { hasSome: product.tags } },
        ],
      },
      orderBy: [
        { isBestseller: "desc" },
        { rating: "desc" },
      ],
      take: Math.min(parseInt(limit as string, 10) || 4, 50),
      include: {
        category: { select: { name: true } },
        images: { take: 1, orderBy: { position: 'asc' } },
      },
    });

    return res.json({
      products: relatedProducts.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: p.price,
        comparePrice: p.comparePrice,
        currency: p.currency,
        rating: p.rating,
        imageUrl: p.images[0]?.url || null,
        category: p.category?.name,
        shippingBadge: (p.cjProductId || p.aliexpressProductId) ? "From Abroad" : "Express",
      })),
    });
  } catch (error) {
    console.error("Get related products error:", error);
    return res.status(500).json({ error: "Failed to fetch related products" });
  }
});

// GET /api/products/categories
router.get("/categories/list", async (_req: Request, res: Response) => {
  try {
    const categories = await cacheGetOrSet("categories:list", async () => {
      const cats = await prisma.category.findMany({
        include: {
          _count: { select: { products: true } },
        },
      });
      return cats.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        productCount: c._count.products,
      }));
    }, 86400); // 24 hour cache

    return res.json(categories);
  } catch (error) {
    console.error("Get categories error:", error);
    return res.status(500).json({ error: "Failed to fetch categories" });
  }
});

export default router;
