import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { cacheGetOrSet, SHORT_TTL, LONG_TTL } from "../lib/cache";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";
import { createFlutterwaveTransfer } from "../services/flutterwave";

const router = Router();

// ─── Public: Browse Affiliate Products ───────────────────────────────────────

// GET /api/affiliate/products - Browse all affiliate products + imported dropship products
router.get("/products", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { source, category, search, featured, sort, page = "1", limit = "20" } = req.query;
    const take = Math.min(parseInt(limit as string) || 20, 50);
    const skip = (Math.max(parseInt(page as string) || 1, 1) - 1) * take;

    // Build filter for imported products (CJ + AliExpress from main Product table)
    const importedWhere: any = {
      status: "ACTIVE",
      OR: [
        { cjProductId: { not: null } },
        { aliexpressProductId: { not: null } },
      ],
    };
    if (source === "CJ") importedWhere.cjProductId = { not: null };
    else if (source === "ALIEXPRESS") importedWhere.aliexpressProductId = { not: null };
    if (category) importedWhere.category = { slug: category };
    if (search) {
      importedWhere.AND = [{
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { tags: { hasSome: [(search as string).toLowerCase()] } },
        ],
      }];
    }

    let orderBy: any = { createdAt: "desc" };
    if (sort === "price_asc") orderBy = { price: "asc" };
    else if (sort === "price_desc") orderBy = { price: "desc" };
    else if (sort === "popular") orderBy = { viewCount: "desc" };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: importedWhere,
        include: {
          category: { select: { name: true, slug: true } },
          images: { orderBy: { position: "asc" }, take: 1 },
        },
        orderBy,
        take,
        skip,
      }),
      prisma.product.count({ where: importedWhere }),
    ]);

    return res.json({
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: Number(p.price),
        originalPrice: p.comparePrice ? Number(p.comparePrice) : null,
        currency: p.currency || "UGX",
        imageUrl: p.images[0]?.url || null,
        source: p.cjProductId ? "CJ" : "ALIEXPRESS",
        category: p.category,
        tags: p.tags,
        rating: p.rating ? Number(p.rating) : null,
        reviewCount: p.reviewCount || 0,
        shippingBadge: "From Abroad",
        isImported: true,
      })),
      pagination: { total, page: Math.floor(skip / take) + 1, limit: take, totalPages: Math.ceil(total / take) },
    });
  } catch (error) {
    logger.error("Browse affiliate products error", { error });
    return res.status(500).json({ error: "Failed to load products" });
  }
}));

// GET /api/affiliate/products/:slug
router.get("/products/:slug", asyncHandler(async (req: Request, res: Response) => {
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
}));

// POST /api/affiliate/products/:id/click - Track an affiliate link click
router.post("/products/:id/click", asyncHandler(async (req: Request, res: Response) => {
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
}));

// GET /api/affiliate/featured - Featured imported products
router.get("/featured", asyncHandler(async (_req: Request, res: Response) => {
  try {
    const data = await cacheGetOrSet("affiliate:featured", async () => {
      const products = await prisma.product.findMany({
        where: {
          status: "ACTIVE",
          OR: [
            { cjProductId: { not: null } },
            { aliexpressProductId: { not: null } },
          ],
        },
        include: {
          category: { select: { name: true } },
          images: { orderBy: { position: "asc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      });
      return products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: Number(p.price),
        originalPrice: p.comparePrice ? Number(p.comparePrice) : null,
        imageUrl: p.images[0]?.url || null,
        source: p.cjProductId ? "CJ" : "ALIEXPRESS",
        rating: p.rating ? Number(p.rating) : null,
        reviewCount: p.reviewCount || 0,
        category: p.category?.name || null,
        shippingBadge: "From Abroad",
        isImported: true,
      }));
    }, SHORT_TTL);

    return res.json({ products: data });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load featured products" });
  }
}));

// ─── Our Affiliate Program: Public Signup & Dashboard ────────────────────────

// POST /api/affiliate/signup - Apply to become an affiliate
router.post("/signup", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const data = z.object({
      name: z.string().min(2),
      email: z.string().email(),
      website: z.string().url().optional(),
      socialMedia: z.string().optional(),
    }).parse(req.body);

    const userId = req.user!.id;

    // Check if user already has an affiliate account or application
    const userExisting = await prisma.affiliate.findUnique({ where: { userId } });
    if (userExisting) {
      return res.status(400).json({ error: "You already have an affiliate account or application" });
    }

    // Check if already exists
    const existing = await prisma.affiliate.findUnique({ where: { email: data.email } });
    if (existing) return res.status(409).json({ error: "An application with this email already exists" });

    // Generate unique code
    const code = data.name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6) + Math.random().toString(36).slice(2, 6).toUpperCase();

    const affiliate = await prisma.affiliate.create({
      data: {
        userId,
        name: data.name,
        email: data.email,
        website: data.website,
        socialMedia: data.socialMedia,
        code,
        status: "PENDING",
      },
    });

    return res.status(201).json({
      message: "Application submitted! We'll review it shortly.",
      affiliateId: affiliate.id,
      code: affiliate.code,
    });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    logger.error("Affiliate signup error", { error });
    return res.status(500).json({ error: "Failed to submit application" });
  }
}));

// GET /api/affiliate/dashboard - Affiliate's own dashboard (authenticated)
router.get("/dashboard/:code", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const affiliate = await prisma.affiliate.findUnique({
      where: { code: req.params.code },
      include: {
        conversions: { orderBy: { createdAt: "desc" }, take: 20 },
        payouts: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });

    if (!affiliate) return res.status(404).json({ error: "Affiliate not found" });

    // Verify the authenticated user owns this affiliate account
    if (affiliate.userId !== req.user!.id) {
      return res.status(403).json({ error: "Access denied" });
    }

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
      paymentPhone: affiliate.paymentPhone,
      paymentProvider: affiliate.paymentProvider,
      paymentName: affiliate.paymentName,
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
    logger.error("Affiliate dashboard error", { error });
    return res.status(500).json({ error: "Failed to load dashboard" });
  }
}));

// PUT /api/affiliate/settings/:code - Update payment details
router.put("/settings/:code", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.params;
    const data = z.object({
      paymentPhone: z.string().min(9),
      paymentProvider: z.string().min(2),
      paymentName: z.string().min(2),
    }).parse(req.body);

    const affiliate = await prisma.affiliate.findUnique({ where: { code } });
    if (!affiliate) return res.status(404).json({ error: "Affiliate not found" });

    // Verify the authenticated user owns this affiliate account
    if (affiliate.userId !== req.user!.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const updated = await prisma.affiliate.update({
      where: { id: affiliate.id },
      data: {
        paymentPhone: data.paymentPhone,
        paymentProvider: data.paymentProvider,
        paymentName: data.paymentName,
      },
    });

    return res.json({
      message: "Payment details updated successfully",
      paymentPhone: updated.paymentPhone,
      paymentProvider: updated.paymentProvider,
      paymentName: updated.paymentName,
    });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    logger.error("Update affiliate settings error", { error });
    return res.status(500).json({ error: "Failed to update payment details" });
  }
}));

// POST /api/affiliate/payout/request - Request a self-serve mobile money payout
router.post("/payout/request", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const affiliate = await prisma.affiliate.findUnique({
      where: { userId: req.user!.id },
    });

    if (!affiliate) {
      return res.status(404).json({ error: "Affiliate profile not found" });
    }

    if (affiliate.status !== "APPROVED") {
      return res.status(403).json({ error: "Affiliate account is not approved" });
    }

    const pendingAmount = Number(affiliate.pendingPayout);
    if (pendingAmount < 20000) {
      return res.status(400).json({ error: "Minimum payout threshold is 20,000 UGX" });
    }

    if (!affiliate.paymentPhone || !affiliate.paymentProvider) {
      return res.status(400).json({
        error: "Please configure your Mobile Money Phone Number and Network Provider in settings first.",
      });
    }

    let accountBank = "";
    const provider = affiliate.paymentProvider.toUpperCase().trim();
    if (provider.includes("MTN")) {
      accountBank = "MPS"; // MTN Uganda Mobile Money bank code
    } else if (provider.includes("AIR")) {
      accountBank = "AIR"; // Airtel Uganda Mobile Money bank code
    } else {
      accountBank = provider; // fallback
    }

    const transferRef = `aff-payout-${Date.now()}`;
    let flwNotes = "";

    try {
      const transferResult = await createFlutterwaveTransfer({
        reference: transferRef,
        amount: pendingAmount,
        narration: `Self-serve affiliate payout for ${affiliate.name}`,
        beneficiary: {
          account_bank: accountBank,
          account_number: affiliate.paymentPhone,
          beneficiary_name: affiliate.paymentName || affiliate.name,
        },
      });
      flwNotes = `Flutterwave transfer initiated. FLW ID: ${transferResult.data?.id || "pending"}.`;
    } catch (err: any) {
      logger.error("Flutterwave affiliate payout failed", { error: err.message, affiliateId: affiliate.id });
      return res.status(500).json({ error: `Flutterwave mobile money transfer failed: ${err.message}` });
    }

    // Process database updates in transaction
    const result = await prisma.$transaction(async (tx) => {
      const aff = await tx.affiliate.findUnique({ where: { id: affiliate.id } });
      if (!aff) throw new Error("NOT_FOUND");
      if (Number(aff.pendingPayout) < pendingAmount) throw new Error("INSUFFICIENT_BALANCE");

      await tx.affiliatePayout.create({
        data: {
          affiliateId: aff.id,
          amount: pendingAmount,
          method: "mobile_money",
          reference: transferRef,
          notes: flwNotes,
        },
      });

      await tx.affiliate.update({
        where: { id: aff.id },
        data: {
          pendingPayout: { decrement: pendingAmount },
          totalPaid: { increment: pendingAmount },
        },
      });

      // Mark associated APPROVED conversions as PAID (oldest first, up to pendingAmount)
      const conversions = await tx.affiliateConversion.findMany({
        where: { affiliateId: aff.id, status: "APPROVED" },
        orderBy: { createdAt: "asc" },
        select: { id: true, commission: true },
      });

      let remaining = pendingAmount;
      const conversionIds: string[] = [];
      for (const c of conversions) {
        if (remaining <= 0) break;
        conversionIds.push(c.id);
        remaining -= Number(c.commission);
      }

      if (conversionIds.length > 0) {
        await tx.affiliateConversion.updateMany({
          where: { id: { in: conversionIds } },
          data: { status: "PAID", paidAt: new Date() },
        });
      }

      return { paid: conversionIds.length };
    });

    return res.json({
      message: "Automated Mobile Money transfer initiated",
      conversionsPaid: result.paid,
      reference: transferRef,
    });
  } catch (error: any) {
    if (error?.message === "NOT_FOUND") return res.status(404).json({ error: "Affiliate not found" });
    if (error?.message === "INSUFFICIENT_BALANCE") {
      return res.status(400).json({ error: "Payout amount exceeds pending balance" });
    }
    logger.error("Affiliate self-serve payout error", { error });
    return res.status(500).json({ error: "Failed to process payout" });
  }
}));

// ─── Track affiliate referrals on checkout (middleware helper) ────────────────

// POST /api/affiliate/track-referral - Called during checkout if ?ref= param exists
router.post("/track-referral", asyncHandler(async (req: Request, res: Response) => {
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
        },
      }),
    ]);

    return res.json({ tracked: true, commission });
  } catch (error) {
    logger.error("Track referral error", { error });
    return res.json({ tracked: false });
  }
}));

export default router;
