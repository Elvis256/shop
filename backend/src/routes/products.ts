import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";

const router = Router();

// GET /api/products
router.get("/", async (req: Request, res: Response) => {
  try {
    const { category, minPrice, maxPrice, sort, sortBy, sortOrder, status, limit = "20", page = "1" } = req.query;

    const take = Math.min(parseInt(limit as string, 10) || 20, 100);
    const skip = (Math.max(parseInt(page as string, 10) || 1, 1) - 1) * take;

    const where: any = {};

    if (category) {
      where.category = { slug: category };
    }

    if (status) {
      where.status = status;
    }

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice as string);
      if (maxPrice) where.price.lte = parseFloat(maxPrice as string);
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

    return res.json({
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
      })),
      pagination: {
        total,
        page: Math.floor(skip / take) + 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error("Get products error:", error);
    return res.status(500).json({ error: "Failed to fetch products" });
  }
});

// GET /api/products/:slug
router.get("/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: { orderBy: { position: 'asc' } },
        variants: true,
      },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    return res.json({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: product.price,
      comparePrice: product.comparePrice,
      currency: product.currency,
      rating: product.rating,
      reviewCount: product.reviewCount,
      imageUrl: product.images[0]?.url || null,
      images: product.images.map(img => img.url),
      category: product.category,
      inStock: product.stock > 0,
      stock: product.stock,
      lowStockAlert: product.lowStockAlert,
      isNew: product.isNew,
      isBestseller: product.isBestseller,
      badgeText: product.badgeText,
      hasVariants: product.hasVariants,
      variants: product.variants,
      tags: product.tags,
    });
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
      take: parseInt(limit as string, 10),
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
    const categories = await prisma.category.findMany({
      include: {
        _count: { select: { products: true } },
      },
    });

    return res.json(
      categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        productCount: c._count.products,
      }))
    );
  } catch (error) {
    console.error("Get categories error:", error);
    return res.status(500).json({ error: "Failed to fetch categories" });
  }
});

export default router;
