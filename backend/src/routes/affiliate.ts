import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { cacheGetOrSet, SHORT_TTL, LONG_TTL } from "../lib/cache";

const router = Router();

// ─── Public: Browse Affiliate Products ───────────────────────────────────────

// GET /api/affiliate/products - Browse all affiliate products
router.get("/products", async (req: Request, res: Response) => {
  try {
    const { source, category, search, featured, sort, page = "1", limit = "20" } = req.query;
    const take = Math.min(parseInt(limit as string) || 20, 50);
    const skip = (Math.max(parseInt(page as string) || 1, 1) - 1) * take;

    const where: any = { isActive: true };
    if (source) where.source = source;
    if (category) where.category = { slug: category };
    if (featured === "true") where.isFeatured = true;
    if (search) where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { tags: { hasSome: [(search as string).toLowerCase()] } },
    ];

    let orderBy: any = { createdAt: "desc" };
    if (sort === "price_asc") orderBy = { price: "asc" };
    else if (sort === "price_desc") orderBy = { price: "desc" };
    else if (sort === "rating") orderBy = { rating: "desc" };
    else if (sort === "popular") orderBy = { clicks: { _count: "desc" } };

    const [products, total] = await Promise.all([
      prisma.affiliateProduct.findMany({
        where,
        include: { category: { select: { name: true, slug: true } } },
        orderBy,
        take,
        skip,
      }),
      prisma.affiliateProduct.count({ where }),
    ]);

    return res.json({
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: Number(p.price),
        originalPrice: p.originalPrice ? Number(p.originalPrice) : null,
        currency: p.currency,
        imageUrl: p.imageUrl,
        images: p.images,
        source: p.source,
        affiliateUrl: p.affiliateUrl,
        category: p.category,
        tags: p.tags,
        rating: p.rating ? Number(p.rating) : null,
        reviewCount: p.reviewCount,
        isFeatured: p.isFeatured,
        isAffiliate: true,
      })),
      pagination: { total, page: Math.floor(skip / take) + 1, limit: take, totalPages: Math.ceil(total / take) },
    });
  } catch (error) {
    console.error("Browse affiliate products error:", error);
    return res.status(500).json({ error: "Failed to load products" });
  }
});

// GET /api/affiliate/products/:slug
router.get("/products/:slug", async (req: Request, res: Response) => {
  try {
    const product = await prisma.affiliateProduct.findUnique({
      where: { slug: req.params.slug },
      include: { category: { select: { name: true, slug: true } } },
    });
    if (!product || !product.isActive) return res.status(404).json({ error: "Product not found" });

    return res.json({
      ...product,
      price: Number(product.price),
      originalPrice: product.originalPrice ? Number(product.originalPrice) : null,
      rating: product.rating ? Number(product.rating) : null,
      commissionRate: undefined,
      isAffiliate: true,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load product" });
  }
});

// POST /api/affiliate/products/:id/click - Track an affiliate link click
router.post("/products/:id/click", async (req: Request, res: Response) => {
  try {
    const product = await prisma.affiliateProduct.findUnique({ where: { id: req.params.id } });
    if (!product) return res.status(404).json({ error: "Product not found" });

    // Record click
    await prisma.affiliateClick.create({
      data: {
        affiliateProductId: product.id,
        sessionId: req.body.sessionId || null,
        ipAddress: req.ip || null,
        userAgent: req.headers["user-agent"] || null,
        referrer: req.headers.referer || null,
      },
    });

    return res.json({ affiliateUrl: product.affiliateUrl });
  } catch (error) {
    return res.json({ affiliateUrl: null });
  }
});

// GET /api/affiliate/featured - Featured affiliate products for homepage
router.get("/featured", async (_req: Request, res: Response) => {
  try {
    const data = await cacheGetOrSet("affiliate:featured", async () => {
      const products = await prisma.affiliateProduct.findMany({
        where: { isActive: true, isFeatured: true },
        include: { category: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 8,
      });
      return products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: Number(p.price),
        originalPrice: p.originalPrice ? Number(p.originalPrice) : null,
        imageUrl: p.imageUrl,
        source: p.source,
        affiliateUrl: p.affiliateUrl,
        rating: p.rating ? Number(p.rating) : null,
        reviewCount: p.reviewCount,
        category: p.category?.name || null,
        isAffiliate: true,
      }));
    }, SHORT_TTL);

    return res.json({ products: data });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load featured products" });
  }
});

// ─── Our Affiliate Program: Public Signup & Dashboard ────────────────────────

// POST /api/affiliate/signup - Apply to become an affiliate
router.post("/signup", async (req: Request, res: Response) => {
  try {
    const data = z.object({
      name: z.string().min(2),
      email: z.string().email(),
      website: z.string().url().optional(),
      socialMedia: z.string().optional(),
    }).parse(req.body);

    // Check if already exists
    const existing = await prisma.affiliate.findUnique({ where: { email: data.email } });
    if (existing) return res.status(409).json({ error: "An application with this email already exists" });

    // Generate unique code
    const code = data.name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6) + Math.random().toString(36).slice(2, 6).toUpperCase();

    const affiliate = await prisma.affiliate.create({
      data: { ...data, code, status: "PENDING" },
    });

    return res.status(201).json({
      message: "Application submitted! We'll review it shortly.",
      affiliateId: affiliate.id,
      code: affiliate.code,
    });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Affiliate signup error:", error);
    return res.status(500).json({ error: "Failed to submit application" });
  }
});

// GET /api/affiliate/dashboard - Affiliate's own dashboard (by code)
router.get("/dashboard/:code", async (req: Request, res: Response) => {
  try {
    const affiliate = await prisma.affiliate.findUnique({
      where: { code: req.params.code },
      include: {
        conversions: { orderBy: { createdAt: "desc" }, take: 20 },
        payouts: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });

    if (!affiliate) return res.status(404).json({ error: "Affiliate not found" });
    if (affiliate.status !== "APPROVED") return res.status(403).json({ error: "Account not yet approved" });

    return res.json({
      name: affiliate.name,
      code: affiliate.code,
      commissionRate: Number(affiliate.commissionRate),
      totalClicks: affiliate.totalClicks,
      totalOrders: affiliate.totalOrders,
      totalEarnings: Number(affiliate.totalEarnings),
      pendingPayout: Number(affiliate.pendingPayout),
      totalPaid: Number(affiliate.totalPaid),
      referralLink: `${process.env.BASE_URL || "https://ugsex.com"}/?ref=${affiliate.code}`,
      recentConversions: affiliate.conversions.map((c) => ({
        id: c.id,
        orderId: c.orderId,
        orderAmount: Number(c.orderAmount),
        commission: Number(c.commission),
        status: c.status,
        createdAt: c.createdAt,
      })),
      recentPayouts: affiliate.payouts.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        method: p.method,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    console.error("Affiliate dashboard error:", error);
    return res.status(500).json({ error: "Failed to load dashboard" });
  }
});

// ─── Track affiliate referrals on checkout (middleware helper) ────────────────

// POST /api/affiliate/track-referral - Called during checkout if ?ref= param exists
router.post("/track-referral", async (req: Request, res: Response) => {
  try {
    const { code, orderId, orderAmount } = z.object({
      code: z.string(),
      orderId: z.string(),
      orderAmount: z.number().positive(),
    }).parse(req.body);

    const affiliate = await prisma.affiliate.findUnique({ where: { code } });
    if (!affiliate || affiliate.status !== "APPROVED") {
      return res.json({ tracked: false });
    }

    const commission = orderAmount * (Number(affiliate.commissionRate) / 100);

    await prisma.$transaction([
      prisma.affiliateConversion.create({
        data: {
          affiliateId: affiliate.id,
          orderId,
          orderAmount,
          commission,
          status: "PENDING",
        },
      }),
      prisma.affiliate.update({
        where: { id: affiliate.id },
        data: {
          totalOrders: { increment: 1 },
          totalEarnings: { increment: commission },
          pendingPayout: { increment: commission },
        },
      }),
    ]);

    return res.json({ tracked: true, commission });
  } catch (error) {
    console.error("Track referral error:", error);
    return res.json({ tracked: false });
  }
});

export default router;
