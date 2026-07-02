import { Router, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";
import { cacheDel } from "../lib/cache";

const router = Router();

interface SellerRequest extends AuthRequest {
  seller?: any;
}

async function invalidatePromotionsCache() {
  try {
    await cacheDel("active-promotions:all");
    await cacheDel("active-promotions:vip");
  } catch (err) {
    logger.error("Failed to invalidate promotions cache", { error: err });
  }
}

async function requireSeller(req: SellerRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Authentication required" });
  const seller = await prisma.seller.findUnique({ where: { userId: req.user.id } });
  if (!seller || seller.status !== "APPROVED") {
    return res.status(403).json({ error: "Seller access required" });
  }
  req.seller = seller;
  next();
}

router.use(authenticate, requireSeller);

// Pricing constants (UGX per day)
const TIER_PRICING = {
  BASIC:   { rate: 5000,  boost: 1.5, label: "Basic — 1.5× boost" },
  PREMIUM: { rate: 15000, boost: 3,   label: "Premium — 3× boost, top of category" },
  VIP:     { rate: 30000, boost: 5,   label: "VIP — 5× boost, homepage + search top" },
} as const;

// GET /api/seller/ads/pricing
router.get("/pricing", (_req: SellerRequest, res: Response) => {
  const tiers = Object.entries(TIER_PRICING).map(([tier, config]) => ({
    tier,
    dailyRate: config.rate,
    boost: config.boost,
    label: config.label,
  }));
  return res.json({ tiers });
});

// GET /api/seller/ads/balance
router.get("/balance", asyncHandler(async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller;
    const transactions = await prisma.adTransaction.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return res.json({
      adBalance: Number(seller.adBalance),
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        description: t.description,
        balanceAfter: Number(t.balanceAfter),
        createdAt: t.createdAt,
      })),
    });
  } catch (error) {
    logger.error("Get ad balance error", { error });
    return res.status(500).json({ error: "Failed to fetch balance" });
  }
}));

// POST /api/seller/ads/fund — transfer from earnings balance to ad balance
router.post("/fund", asyncHandler(async (req: SellerRequest, res: Response) => {
  try {
    const { amount } = req.body;
    const transferAmount = parseFloat(amount);
    if (!transferAmount || transferAmount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const seller = await tx.seller.findUnique({ where: { id: req.seller.id } });
      if (!seller) throw new Error("Seller not found");

      if (Number(seller.balance) < transferAmount) {
        throw new Error("Insufficient earnings balance");
      }

      const newAdBalance = Number(seller.adBalance) + transferAmount;

      await tx.seller.update({
        where: { id: seller.id },
        data: {
          balance: { decrement: transferAmount },
          adBalance: { increment: transferAmount },
        },
      });

      const transaction = await tx.adTransaction.create({
        data: {
          sellerId: seller.id,
          type: "FUND",
          amount: transferAmount,
          description: `Funded from earnings balance`,
          balanceAfter: newAdBalance,
        },
      });

      return { adBalance: newAdBalance, transaction };
    });

    return res.json({
      message: "Ad balance funded successfully",
      adBalance: result.adBalance,
    });
  } catch (error: any) {
    if (error.message === "Insufficient earnings balance") {
      return res.status(400).json({ error: error.message });
    }
    logger.error("Fund ad balance error", { error });
    return res.status(500).json({ error: "Failed to fund ad balance" });
  }
}));

// GET /api/seller/ads/promotions
router.get("/promotions", asyncHandler(async (req: SellerRequest, res: Response) => {
  try {
    const { status } = req.query;
    const where: any = { sellerId: req.seller.id };
    if (status) where.status = status;

    const promotions = await prisma.productPromotion.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        product: { select: { id: true, name: true, slug: true, images: { take: 1, orderBy: { position: "asc" } } } },
      },
    });

    return res.json({
      promotions: promotions.map((p) => ({
        id: p.id,
        productId: p.productId,
        productName: p.product.name,
        productSlug: p.product.slug,
        productImage: p.product.images[0]?.url || null,
        tier: p.tier,
        status: p.status,
        startDate: p.startDate,
        endDate: p.endDate,
        dailyRate: Number(p.dailyRate),
        totalBudget: Number(p.totalBudget),
        spent: Number(p.spent),
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    logger.error("Get promotions error", { error });
    return res.status(500).json({ error: "Failed to fetch promotions" });
  }
}));

// POST /api/seller/ads/promotions — create a new promotion
router.post("/promotions", asyncHandler(async (req: SellerRequest, res: Response) => {
  try {
    const { productId, tier, days } = req.body;

    if (!productId || !tier || !days) {
      return res.status(400).json({ error: "productId, tier, and days are required" });
    }

    const tierConfig = TIER_PRICING[tier as keyof typeof TIER_PRICING];
    if (!tierConfig) {
      return res.status(400).json({ error: "Invalid tier. Use BASIC, PREMIUM, or VIP" });
    }

    const durationDays = parseInt(days);
    if (isNaN(durationDays) || durationDays < 1 || durationDays > 90) {
      return res.status(400).json({ error: "Duration must be 1-90 days" });
    }

    // Validate product ownership and status
    const product = await prisma.product.findFirst({
      where: { id: productId, sellerId: req.seller.id, status: "ACTIVE" },
    });
    if (!product) {
      return res.status(400).json({ error: "Product not found, not yours, or not active" });
    }

    // Check no existing active promotion for this product
    const existingPromo = await prisma.productPromotion.findFirst({
      where: { productId, status: { in: ["ACTIVE", "PAUSED"] } },
    });
    if (existingPromo) {
      return res.status(400).json({ error: "Product already has an active promotion" });
    }

    const totalBudget = tierConfig.rate * durationDays;

    const result = await prisma.$transaction(async (tx) => {
      const seller = await tx.seller.findUnique({ where: { id: req.seller.id } });
      if (!seller) throw new Error("Seller not found");

      if (Number(seller.adBalance) < totalBudget) {
        throw new Error("Insufficient ad balance");
      }

      const newAdBalance = Number(seller.adBalance) - totalBudget;

      await tx.seller.update({
        where: { id: seller.id },
        data: { adBalance: { decrement: totalBudget } },
      });

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + durationDays);

      const promotion = await tx.productPromotion.create({
        data: {
          sellerId: seller.id,
          productId,
          tier: tier as any,
          status: "ACTIVE",
          startDate,
          endDate,
          dailyRate: tierConfig.rate,
          totalBudget,
          spent: 0,
        },
      });

      await tx.adTransaction.create({
        data: {
          sellerId: seller.id,
          type: "DEBIT",
          amount: totalBudget,
          description: `${tier} promotion for "${product.name}" (${durationDays} days)`,
          balanceAfter: newAdBalance,
        },
      });

      return promotion;
    });

    await invalidatePromotionsCache();

    return res.status(201).json({
      message: "Promotion created successfully",
      promotion: {
        id: result.id,
        tier: result.tier,
        startDate: result.startDate,
        endDate: result.endDate,
        totalBudget: Number(result.totalBudget),
      },
    });
  } catch (error: any) {
    if (error.message === "Insufficient ad balance") {
      return res.status(400).json({ error: error.message });
    }
    logger.error("Create promotion error", { error });
    return res.status(500).json({ error: "Failed to create promotion" });
  }
}));

// PUT /api/seller/ads/promotions/:id/pause
router.put("/promotions/:id/pause", asyncHandler(async (req: SellerRequest, res: Response) => {
  try {
    const promo = await prisma.productPromotion.findFirst({
      where: { id: req.params.id, sellerId: req.seller.id, status: "ACTIVE" },
    });
    if (!promo) return res.status(404).json({ error: "Active promotion not found" });

    await prisma.productPromotion.update({
      where: { id: promo.id },
      data: { status: "PAUSED" },
    });

    await invalidatePromotionsCache();

    return res.json({ message: "Promotion paused" });
  } catch (error) {
    logger.error("Pause promotion error", { error });
    return res.status(500).json({ error: "Failed to pause promotion" });
  }
}));

// PUT /api/seller/ads/promotions/:id/resume
router.put("/promotions/:id/resume", asyncHandler(async (req: SellerRequest, res: Response) => {
  try {
    const promo = await prisma.productPromotion.findFirst({
      where: { id: req.params.id, sellerId: req.seller.id, status: "PAUSED" },
    });
    if (!promo) return res.status(404).json({ error: "Paused promotion not found" });

    if (new Date() > promo.endDate) {
      return res.status(400).json({ error: "Promotion has expired" });
    }

    await prisma.productPromotion.update({
      where: { id: promo.id },
      data: { status: "ACTIVE" },
    });

    await invalidatePromotionsCache();

    return res.json({ message: "Promotion resumed" });
  } catch (error) {
    logger.error("Resume promotion error", { error });
    return res.status(500).json({ error: "Failed to resume promotion" });
  }
}));

// DELETE /api/seller/ads/promotions/:id — cancel and refund remaining
router.delete("/promotions/:id", asyncHandler(async (req: SellerRequest, res: Response) => {
  try {
    const promo = await prisma.productPromotion.findFirst({
      where: { id: req.params.id, sellerId: req.seller.id, status: { in: ["ACTIVE", "PAUSED"] } },
    });
    if (!promo) return res.status(404).json({ error: "Promotion not found or already ended" });

    const refundAmount = Number(promo.totalBudget) - Number(promo.spent);

    if (refundAmount > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.productPromotion.update({
          where: { id: promo.id },
          data: { status: "CANCELLED" },
        });

        const seller = await tx.seller.findUnique({ where: { id: req.seller.id } });
        const newAdBalance = Number(seller!.adBalance) + refundAmount;

        await tx.seller.update({
          where: { id: req.seller.id },
          data: { adBalance: { increment: refundAmount } },
        });

        await tx.adTransaction.create({
          data: {
            sellerId: req.seller.id,
            type: "REFUND",
            amount: refundAmount,
            description: `Refund for cancelled ${promo.tier} promotion`,
            balanceAfter: newAdBalance,
          },
        });
      });
    } else {
      await prisma.productPromotion.update({
        where: { id: promo.id },
        data: { status: "CANCELLED" },
      });
    }

    await invalidatePromotionsCache();

    return res.json({ message: "Promotion cancelled", refunded: refundAmount });
  } catch (error) {
    logger.error("Cancel promotion error", { error });
    return res.status(500).json({ error: "Failed to cancel promotion" });
  }
}));

export default router;
