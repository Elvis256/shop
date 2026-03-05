import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";

const router = Router();
router.use(authenticate, requireAdmin);

// ─── Affiliate Products (external products we earn commission on) ────────────

// GET /api/admin/affiliate-products
router.get("/products", async (req: AuthRequest, res: Response) => {
  try {
    const { source, active, search, page = "1", limit = "20" } = req.query;
    const take = Math.min(parseInt(limit as string) || 20, 100);
    const skip = (Math.max(parseInt(page as string) || 1, 1) - 1) * take;

    const where: any = {};
    if (source) where.source = source;
    if (active !== undefined) where.isActive = active === "true";
    if (search) where.name = { contains: search, mode: "insensitive" };

    const [products, total] = await Promise.all([
      prisma.affiliateProduct.findMany({
        where,
        include: { category: { select: { name: true } }, _count: { select: { clicks: true } } },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.affiliateProduct.count({ where }),
    ]);

    return res.json({
      products: products.map((p) => ({
        ...p,
        price: Number(p.price),
        originalPrice: p.originalPrice ? Number(p.originalPrice) : null,
        commissionRate: p.commissionRate ? Number(p.commissionRate) : null,
        rating: p.rating ? Number(p.rating) : null,
        clicks: p._count.clicks,
        categoryName: p.category?.name || null,
      })),
      pagination: { total, page: Math.floor(skip / take) + 1, limit: take, totalPages: Math.ceil(total / take) },
    });
  } catch (error) {
    console.error("Admin affiliate products error:", error);
    return res.status(500).json({ error: "Failed to load affiliate products" });
  }
});

// POST /api/admin/affiliate-products
router.post("/products", async (req: AuthRequest, res: Response) => {
  try {
    const data = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      price: z.number().positive(),
      originalPrice: z.number().positive().optional(),
      currency: z.string().default("USD"),
      imageUrl: z.string().url().optional(),
      images: z.array(z.string().url()).default([]),
      affiliateUrl: z.string().url(),
      source: z.enum(["AMAZON", "ALIEXPRESS", "ALIBABA", "MANUAL"]),
      sourceProductId: z.string().optional(),
      categoryId: z.string().optional(),
      tags: z.array(z.string()).default([]),
      rating: z.number().min(0).max(5).optional(),
      reviewCount: z.number().int().min(0).default(0),
      commissionRate: z.number().min(0).max(100).optional(),
      isActive: z.boolean().default(true),
      isFeatured: z.boolean().default(false),
    }).parse(req.body);

    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now();

    const product = await prisma.affiliateProduct.create({
      data: { ...data, slug } as any,
    });

    return res.status(201).json({ product });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Create affiliate product error:", error);
    return res.status(500).json({ error: "Failed to create affiliate product" });
  }
});

// PUT /api/admin/affiliate-products/:id
router.put("/products/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      price: z.number().positive().optional(),
      originalPrice: z.number().positive().nullable().optional(),
      imageUrl: z.string().url().optional(),
      images: z.array(z.string().url()).optional(),
      affiliateUrl: z.string().url().optional(),
      source: z.enum(["AMAZON", "ALIEXPRESS", "ALIBABA", "MANUAL"]).optional(),
      sourceProductId: z.string().optional(),
      categoryId: z.string().nullable().optional(),
      tags: z.array(z.string()).optional(),
      rating: z.number().min(0).max(5).optional(),
      reviewCount: z.number().int().min(0).optional(),
      commissionRate: z.number().min(0).max(100).optional(),
      isActive: z.boolean().optional(),
      isFeatured: z.boolean().optional(),
    }).parse(req.body);

    const product = await prisma.affiliateProduct.update({ where: { id }, data: data as any });
    return res.json({ product });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Update affiliate product error:", error);
    return res.status(500).json({ error: "Failed to update affiliate product" });
  }
});

// DELETE /api/admin/affiliate-products/:id
router.delete("/products/:id", async (req: AuthRequest, res: Response) => {
  try {
    await prisma.affiliateProduct.delete({ where: { id: req.params.id } });
    return res.json({ message: "Affiliate product deleted" });
  } catch (error) {
    console.error("Delete affiliate product error:", error);
    return res.status(500).json({ error: "Failed to delete affiliate product" });
  }
});

// POST /api/admin/affiliate-products/import - Import from URL/API
router.post("/products/import", async (req: AuthRequest, res: Response) => {
  try {
    const { products } = z.object({
      products: z.array(z.object({
        name: z.string(),
        price: z.number().positive(),
        originalPrice: z.number().positive().optional(),
        imageUrl: z.string().optional(),
        images: z.array(z.string()).default([]),
        affiliateUrl: z.string().url(),
        source: z.enum(["AMAZON", "ALIEXPRESS", "ALIBABA", "MANUAL"]),
        sourceProductId: z.string().optional(),
        description: z.string().optional(),
        rating: z.number().optional(),
        reviewCount: z.number().optional(),
        commissionRate: z.number().optional(),
        categoryId: z.string().optional(),
        tags: z.array(z.string()).default([]),
      })),
    }).parse(req.body);

    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const p of products) {
      try {
        const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now() + "-" + imported;
        await prisma.affiliateProduct.create({ data: { ...p, slug, isActive: true } as any });
        imported++;
      } catch (err: any) {
        failed++;
        errors.push(`${p.name}: ${err?.message || "unknown"}`);
      }
    }

    return res.json({ imported, failed, errors: errors.slice(0, 10) });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    return res.status(500).json({ error: "Failed to import products" });
  }
});

// GET /api/admin/affiliate-products/stats
router.get("/products/stats", async (req: AuthRequest, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const since = new Date(Date.now() - days * 86400000);

    const [totalProducts, activeProducts, totalClicks, clicksBySource, topClicked] = await Promise.all([
      prisma.affiliateProduct.count(),
      prisma.affiliateProduct.count({ where: { isActive: true } }),
      prisma.affiliateClick.count({ where: { createdAt: { gte: since } } }),
      prisma.affiliateClick.groupBy({
        by: ["affiliateProductId"],
        where: { createdAt: { gte: since } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
      prisma.affiliateProduct.findMany({
        where: { isActive: true },
        include: { _count: { select: { clicks: true } } },
        orderBy: { clicks: { _count: "desc" } },
        take: 10,
      }),
    ]);

    return res.json({
      totalProducts,
      activeProducts,
      totalClicks,
      topClicked: topClicked.map((p) => ({
        id: p.id, name: p.name, source: p.source, clicks: p._count.clicks,
        imageUrl: p.imageUrl, affiliateUrl: p.affiliateUrl,
      })),
    });
  } catch (error) {
    console.error("Affiliate stats error:", error);
    return res.status(500).json({ error: "Failed to load stats" });
  }
});

// ─── Our Affiliate Program (people who promote our products) ─────────────────

// GET /api/admin/affiliates
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { status, search } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (search) where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
    ];

    const affiliates = await prisma.affiliate.findMany({
      where,
      include: { _count: { select: { conversions: true, payouts: true } } },
      orderBy: { createdAt: "desc" },
    });

    return res.json({
      affiliates: affiliates.map((a) => ({
        ...a,
        commissionRate: Number(a.commissionRate),
        totalEarnings: Number(a.totalEarnings),
        pendingPayout: Number(a.pendingPayout),
        totalPaid: Number(a.totalPaid),
        conversions: a._count.conversions,
        payoutsCount: a._count.payouts,
      })),
    });
  } catch (error) {
    console.error("Admin affiliates error:", error);
    return res.status(500).json({ error: "Failed to load affiliates" });
  }
});

// PUT /api/admin/affiliates/:id - Approve/reject/update affiliate
router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const data = z.object({
      status: z.enum(["PENDING", "APPROVED", "REJECTED", "SUSPENDED"]).optional(),
      commissionRate: z.number().min(0).max(100).optional(),
    }).parse(req.body);

    const affiliate = await prisma.affiliate.update({ where: { id: req.params.id }, data: data as any });
    return res.json({ affiliate });
  } catch (error) {
    console.error("Update affiliate error:", error);
    return res.status(500).json({ error: "Failed to update affiliate" });
  }
});

// POST /api/admin/affiliates/:id/payout
router.post("/:id/payout", async (req: AuthRequest, res: Response) => {
  try {
    const { amount, method, reference, notes } = z.object({
      amount: z.number().positive(),
      method: z.string(),
      reference: z.string().optional(),
      notes: z.string().optional(),
    }).parse(req.body);

    const affiliate = await prisma.affiliate.findUnique({ where: { id: req.params.id } });
    if (!affiliate) return res.status(404).json({ error: "Affiliate not found" });
    if (Number(affiliate.pendingPayout) < amount) {
      return res.status(400).json({ error: "Payout amount exceeds pending balance" });
    }

    await prisma.$transaction([
      prisma.affiliatePayout.create({
        data: { affiliateId: affiliate.id, amount, method, reference, notes },
      }),
      prisma.affiliate.update({
        where: { id: affiliate.id },
        data: {
          pendingPayout: { decrement: amount },
          totalPaid: { increment: amount },
        },
      }),
      prisma.affiliateConversion.updateMany({
        where: { affiliateId: affiliate.id, status: "APPROVED" },
        data: { status: "PAID", paidAt: new Date() },
      }),
    ]);

    return res.json({ message: "Payout processed" });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed" });
    console.error("Payout error:", error);
    return res.status(500).json({ error: "Failed to process payout" });
  }
});

export default router;
