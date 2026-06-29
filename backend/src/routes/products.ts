import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { cacheGetOrSet, cacheGet, cacheDel, cacheSet, trackTrending, SHORT_TTL, LONG_TTL } from "../lib/cache";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

// GET /api/products
router.get("/", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { category, minPrice, maxPrice, sort, sortBy, sortOrder, status, limit = "20", page = "1", flashSale, search, subscribable, onSale, featured } = req.query;

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
    } else {
      where.status = "ACTIVE";
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

    if (subscribable === "true") {
      where.isSubscribable = true;
    }

    if (onSale === "true") {
      // Use AND to intersect with existing search filters instead of merging into OR
      const saleCondition = {
        OR: [
          { comparePrice: { not: null } },
          { flashSalePrice: { not: null }, flashSaleEndsAt: { gt: new Date() } },
        ],
      };
      if (where.OR) {
        // search is active — wrap both in AND to intersect
        where.AND = [{ OR: where.OR }, saleCondition];
        delete where.OR;
      } else {
        where.OR = saleCondition.OR;
      }
    }

    if (featured === "true") {
      where.featured = true;
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

    // Fetch active promotions for returned product IDs
    const productIds = products.map((p) => p.id);
    const activePromotions = productIds.length > 0 ? await prisma.productPromotion.findMany({
      where: { productId: { in: productIds }, status: "ACTIVE" },
      select: { productId: true, tier: true },
    }) : [];
    const promoMap = new Map(activePromotions.map((p) => [p.productId, p.tier]));

    // On page 1: fetch up to 3 VIP-promoted products not already in results
    let vipInserts: typeof products = [];
    if (pageNum === 1 && !flashSale) {
      const existingIds = new Set(productIds);
      const vipPromos = await prisma.productPromotion.findMany({
        where: { status: "ACTIVE", tier: "VIP", productId: { notIn: Array.from(existingIds) } },
        take: 3,
        include: { product: { include: { category: { select: { name: true, slug: true } }, images: { take: 1, orderBy: { position: "asc" } } } } },
      });
      vipInserts = vipPromos
        .filter((vp) => vp.product.status === "ACTIVE")
        .map((vp) => vp.product);
      for (const vp of vipInserts) {
        promoMap.set(vp.id, "VIP");
      }
    }

    // Merge and sort: VIP first → PREMIUM → BASIC → regular
    const tierOrder = { VIP: 0, PREMIUM: 1, BASIC: 2 };
    const allProducts = [...vipInserts, ...products];
    allProducts.sort((a, b) => {
      const aTier = promoMap.get(a.id);
      const bTier = promoMap.get(b.id);
      const aOrder = aTier ? tierOrder[aTier as keyof typeof tierOrder] ?? 3 : 3;
      const bOrder = bTier ? tierOrder[bTier as keyof typeof tierOrder] ?? 3 : 3;
      return aOrder - bOrder;
    });

    const responseBody = {
      products: allProducts.map((p) => ({
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
        isSubscribable: p.isSubscribable || false,
        subscriptionDiscount: p.subscriptionDiscount || 0,
        createdAt: p.createdAt.toISOString(),
        isSponsored: promoMap.has(p.id),
        promotionTier: promoMap.get(p.id) || null,
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
    logger.error("Get products error", { error });
    return res.status(500).json({ error: "Failed to fetch products" });
  }
}));

// GET /api/products/feed/google-merchant — Google Merchant Center product feed
router.get("/feed/google-merchant", asyncHandler(async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      where: { status: "ACTIVE" },
      include: {
        category: true,
        images: { take: 5, orderBy: { position: "asc" } }
      }
    });

    const siteUrl = process.env.BASE_URL || "https://ugsex.com";
    const escapeXml = (unsafe: string): string => {
      return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
          case "<": return "&lt;";
          case ">": return "&gt;";
          case "&": return "&amp;";
          case "'": return "&apos;";
          case "\"": return "&quot;";
          default: return c;
        }
      });
    };

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n  <channel>\n    <title>PleasureZone Uganda</title>\n    <link>${siteUrl}</link>\n    <description>Uganda's #1 online store for intimate wellness. Discreet delivery nationwide.</description>\n`;

    const now = new Date();
    for (const p of products) {
      const title = escapeXml(p.name);
      const description = escapeXml(p.description?.replace(/<[^>]*>/g, "").slice(0, 1000) || p.name);
      const link = `${siteUrl}/product/${p.slug}`;
      
      let imageLink = p.images?.[0]?.url || "";
      if (imageLink && imageLink.startsWith("/")) {
        imageLink = `${siteUrl}${imageLink}`;
      }
      if (!imageLink) {
        imageLink = `${siteUrl}/logo.png`;
      }

      const additionalImages = p.images?.slice(1) || [];
      
      const price = `${Math.round(Number(p.price))} UGX`;
      const flashActive = p.flashSalePrice && p.flashSaleEndsAt && p.flashSaleEndsAt > now;
      const salePrice = flashActive ? `${Math.round(Number(p.flashSalePrice))} UGX` : null;

      const availability = p.stock > 0 ? "in_stock" : "out_of_stock";
      const brand = "PleasureZone";
      const condition = "new";
      const gtin = p.barcode ? escapeXml(p.barcode) : null;
      const mpn = p.sku ? escapeXml(p.sku) : null;
      const identifierExists = (gtin || mpn) ? "yes" : "no";

      xml += `    <item>\n`;
      xml += `      <g:id>${p.id}</g:id>\n`;
      xml += `      <g:title>${title}</g:title>\n`;
      xml += `      <g:description>${description}</g:description>\n`;
      xml += `      <g:link>${link}</g:link>\n`;
      xml += `      <g:image_link>${escapeXml(imageLink)}</g:image_link>\n`;
      
      for (const img of additionalImages) {
        let addImgUrl = img.url;
        if (addImgUrl.startsWith("/")) {
          addImgUrl = `${siteUrl}${addImgUrl}`;
        }
        xml += `      <g:additional_image_link>${escapeXml(addImgUrl)}</g:additional_image_link>\n`;
      }

      xml += `      <g:price>${price}</g:price>\n`;
      if (salePrice) {
        xml += `      <g:sale_price>${salePrice}</g:sale_price>\n`;
      }
      xml += `      <g:availability>${availability}</g:availability>\n`;
      xml += `      <g:condition>${condition}</g:condition>\n`;
      xml += `      <g:brand>${brand}</g:brand>\n`;
      if (gtin) {
        xml += `      <g:gtin>${gtin}</g:gtin>\n`;
      }
      if (mpn) {
        xml += `      <g:mpn>${mpn}</g:mpn>\n`;
      }
      xml += `      <g:identifier_exists>${identifierExists}</g:identifier_exists>\n`;
      xml += `      <g:adult>yes</g:adult>\n`;
      if (p.category) {
        xml += `      <g:google_product_category>${escapeXml(p.category.name)}</g:google_product_category>\n`;
        xml += `      <g:product_type>${escapeXml(p.category.name)}</g:product_type>\n`;
      }
      xml += `    </item>\n`;
    }

    xml += `  </channel>\n</rss>`;

    res.setHeader("Content-Type", "application/xml");
    return res.send(xml);
  } catch (error) {
    logger.error("Failed to generate Google Merchant feed", { error });
    return res.status(500).json({ error: "Failed to generate feed" });
  }
}));

// GET /api/products/:slug
router.get("/:slug", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const product = await cacheGetOrSet(`product:${slug}`, async () => {
      const p = await prisma.product.findUnique({
        where: { slug },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          images: { orderBy: { position: 'asc' } },
          variants: true,
          sizeGuide: { select: { id: true, name: true, content: true } },
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
        sizeGuide: p.sizeGuide || null,
      };
    }, LONG_TTL);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    return res.json(product);
  } catch (error) {
    logger.error("Get product error", { error });
    return res.status(500).json({ error: "Failed to fetch product" });
  }
}));

// GET /api/products/:slug/related
router.get("/:slug/related", asyncHandler(async (req: Request, res: Response) => {
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
    logger.error("Get related products error", { error });
    return res.status(500).json({ error: "Failed to fetch related products" });
  }
}));

// GET /api/products/categories
router.get("/categories/list", asyncHandler(async (_req: Request, res: Response) => {
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
    logger.error("Get categories error", { error });
    return res.status(500).json({ error: "Failed to fetch categories" });
  }
}));

export default router;
