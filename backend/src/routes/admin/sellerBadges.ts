import { Router, Response } from "express";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { asyncHandler } from "../../middleware/errorHandler";

const router = Router();

router.use(authenticate, requireAdmin);

// Shared badge calculation logic
async function calculateSellerBadges(sellerId: string, tx: typeof prisma = prisma) {
  const seller = await tx.seller.findUnique({
    where: { id: sellerId },
    include: {
      _count: {
        select: { products: true, orderItems: true, reviews: true, warnings: true, disputes: true },
      },
    },
  });

  if (!seller) return null;

  const badges: string[] = [];
  let trustScore = 0;
  const rating = parseFloat(seller.rating.toString());
  const reviewCount = seller.reviewCount;
  const daysSinceCreated = (Date.now() - seller.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const totalSales = seller.totalSales;
  const disputeCount = seller._count.disputes;
  const disputeRate = totalSales > 0 ? (disputeCount / totalSales) * 100 : 0;
  const warningCount = seller._count.warnings;

  // VERIFIED — has ID document and is approved
  if (seller.status === "APPROVED" && seller.idDocument) {
    badges.push("VERIFIED");
    trustScore += 20;
  }

  // NEW_SELLER — account less than 30 days old
  if (daysSinceCreated <= 30) {
    badges.push("NEW_SELLER");
  }

  // TOP_RATED — rating >= 4.5 with 50+ reviews
  if (rating >= 4.5 && reviewCount >= 50) {
    badges.push("TOP_RATED");
    trustScore += 20;
  } else if (rating >= 4.0 && reviewCount >= 10) {
    trustScore += 10;
  }

  // TRUSTED — 100+ completed orders, low dispute rate
  if (totalSales >= 100 && disputeRate < 2) {
    badges.push("TRUSTED");
    trustScore += 20;
  } else if (totalSales >= 20 && disputeRate < 5) {
    trustScore += 10;
  }

  // FAST_SHIPPER — avg shipping days <= 1
  if (seller.avgShipDays && parseFloat(seller.avgShipDays.toString()) <= 1) {
    badges.push("FAST_SHIPPER");
    trustScore += 10;
  }

  // RESPONSIVE — avg response time <= 2 hours
  if (seller.avgResponseHrs && parseFloat(seller.avgResponseHrs.toString()) <= 2) {
    badges.push("RESPONSIVE");
    trustScore += 10;
  }

  // RISING_STAR — growing fast (sales > 20, <6 months old)
  if (daysSinceCreated <= 180 && totalSales >= 20) {
    badges.push("RISING_STAR");
    trustScore += 10;
  }

  // PREMIUM — GOLD tier + multiple badges
  if (seller.tier === "GOLD" && badges.length >= 3 && rating >= 4.7) {
    badges.push("PREMIUM");
    trustScore += 10;
  }

  // Warning penalty
  if (warningCount > 0) {
    trustScore = Math.max(0, trustScore - warningCount * 10);
  }

  trustScore = Math.min(100, Math.max(0, trustScore));

  // Atomically update seller + sync badges inside transaction
  await tx.seller.update({
    where: { id: sellerId },
    data: { trustScore, disputeRate },
  });

  await tx.sellerBadge.deleteMany({ where: { sellerId } });

  if (badges.length > 0) {
    await tx.sellerBadge.createMany({
      data: badges.map((badge) => ({
        sellerId,
        badge: badge as any,
        isActive: true,
      })),
    });
  }

  return {
    sellerId,
    trustScore,
    badges,
    metrics: {
      rating,
      reviewCount,
      totalSales,
      disputeRate: parseFloat(disputeRate.toFixed(1)),
      warningCount,
      daysSinceCreated: Math.floor(daysSinceCreated),
    },
  };
}

// POST /api/admin/sellers/:id/recalculate-badges — Recalculate seller badges and trust score
router.post("/:id/recalculate-badges", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      return calculateSellerBadges(req.params.id, tx as typeof prisma);
    });

    if (!result) {
      return res.status(404).json({ error: "Seller not found" });
    }

    return res.json(result);
  } catch (error) {
    logger.error("Recalculate badges error", { error });
    return res.status(500).json({ error: "Failed to recalculate badges" });
  }
}));

// POST /api/admin/sellers/recalculate-all-badges — Batch recalculate all seller badges
router.post("/recalculate-all-badges", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const sellers = await prisma.seller.findMany({
      where: { status: "APPROVED" },
      select: { id: true },
    });

    let processed = 0;
    let failed = 0;
    for (const seller of sellers) {
      try {
        await prisma.$transaction(async (tx) => {
          await calculateSellerBadges(seller.id, tx as typeof prisma);
        });
        processed++;
      } catch (err: any) {
        failed++;
        logger.warn("Badge recalc failed for seller", { sellerId: seller.id, error: err.message });
      }
    }

    return res.json({ message: `Recalculated badges for ${processed} sellers`, processed, failed });
  } catch (error) {
    logger.error("Batch recalculate error", { error });
    return res.status(500).json({ error: "Failed to batch recalculate" });
  }
}));

export default router;
