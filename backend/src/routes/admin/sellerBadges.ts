import { Router, Response } from "express";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { asyncHandler } from "../../middleware/errorHandler";

const router = Router();

router.use(authenticate, requireAdmin);

// POST /api/admin/sellers/:id/recalculate-badges — Recalculate seller badges and trust score
router.post("/:id/recalculate-badges", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const sellerId = req.params.id;

    const seller = await prisma.seller.findUnique({
      where: { id: sellerId },
      include: {
        _count: {
          select: {
            products: true,
            orderItems: true,
            reviews: true,
            warnings: true,
            disputes: true,
          },
        },
      },
    });

    if (!seller) {
      return res.status(404).json({ error: "Seller not found" });
    }

    const badges: string[] = [];
    let trustScore = 0;

    // VERIFIED — has ID document and is approved
    if (seller.status === "APPROVED" && seller.idDocument) {
      badges.push("VERIFIED");
      trustScore += 20;
    }

    // NEW_SELLER — account less than 30 days old
    const daysSinceCreated = (Date.now() - seller.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreated <= 30) {
      badges.push("NEW_SELLER");
    }

    // TOP_RATED — rating >= 4.5 with 50+ reviews
    const rating = parseFloat(seller.rating.toString());
    const reviewCount = seller.reviewCount;
    if (rating >= 4.5 && reviewCount >= 50) {
      badges.push("TOP_RATED");
      trustScore += 20;
    } else if (rating >= 4.0 && reviewCount >= 10) {
      trustScore += 10;
    }

    // TRUSTED — 100+ completed orders, low dispute rate
    const totalSales = seller.totalSales;
    const disputeCount = seller._count.disputes;
    const disputeRate = totalSales > 0 ? (disputeCount / totalSales) * 100 : 0;
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

    // RISING_STAR — growing fast (sales > 20 in last 30 days, <6 months old)
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
    const warningCount = seller._count.warnings;
    if (warningCount > 0) {
      trustScore = Math.max(0, trustScore - warningCount * 10);
    }

    trustScore = Math.min(100, Math.max(0, trustScore));

    // Update seller trust score and metrics
    await prisma.seller.update({
      where: { id: sellerId },
      data: {
        trustScore,
        disputeRate,
      },
    });

    // Sync badges — remove old, add new
    await prisma.sellerBadge.deleteMany({ where: { sellerId } });

    if (badges.length > 0) {
      await prisma.sellerBadge.createMany({
        data: badges.map((badge) => ({
          sellerId,
          badge: badge as any,
          isActive: true,
        })),
      });
    }

    return res.json({
      sellerId,
      trustScore,
      badges,
      metrics: {
        rating,
        reviewCount,
        totalSales,
        disputeRate: disputeRate.toFixed(1),
        warningCount,
        daysSinceCreated: Math.floor(daysSinceCreated),
      },
    });
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
    for (const seller of sellers) {
      // Reuse logic by making internal call
      try {
        const s = await prisma.seller.findUnique({
          where: { id: seller.id },
          include: {
            _count: { select: { products: true, orderItems: true, reviews: true, warnings: true, disputes: true } },
          },
        });
        if (!s) continue;

        const badges: string[] = [];
        let trustScore = 0;
        const rating = parseFloat(s.rating.toString());
        const daysSinceCreated = (Date.now() - s.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        const disputeRate = s.totalSales > 0 ? (s._count.disputes / s.totalSales) * 100 : 0;

        if (s.status === "APPROVED" && s.idDocument) { badges.push("VERIFIED"); trustScore += 20; }
        if (daysSinceCreated <= 30) badges.push("NEW_SELLER");
        if (rating >= 4.5 && s.reviewCount >= 50) { badges.push("TOP_RATED"); trustScore += 20; }
        else if (rating >= 4.0 && s.reviewCount >= 10) trustScore += 10;
        if (s.totalSales >= 100 && disputeRate < 2) { badges.push("TRUSTED"); trustScore += 20; }
        else if (s.totalSales >= 20 && disputeRate < 5) trustScore += 10;
        if (s.avgShipDays && parseFloat(s.avgShipDays.toString()) <= 1) { badges.push("FAST_SHIPPER"); trustScore += 10; }
        if (s.avgResponseHrs && parseFloat(s.avgResponseHrs.toString()) <= 2) { badges.push("RESPONSIVE"); trustScore += 10; }
        if (daysSinceCreated <= 180 && s.totalSales >= 20) { badges.push("RISING_STAR"); trustScore += 10; }
        if (s.tier === "GOLD" && badges.length >= 3 && rating >= 4.7) { badges.push("PREMIUM"); trustScore += 10; }
        trustScore = Math.max(0, trustScore - s._count.warnings * 10);
        trustScore = Math.min(100, Math.max(0, trustScore));

        await prisma.seller.update({ where: { id: s.id }, data: { trustScore, disputeRate } });
        await prisma.sellerBadge.deleteMany({ where: { sellerId: s.id } });
        if (badges.length > 0) {
          await prisma.sellerBadge.createMany({ data: badges.map((b) => ({ sellerId: s.id, badge: b as any, isActive: true })) });
        }
        processed++;
      } catch { /* skip individual failures */ }
    }

    return res.json({ message: `Recalculated badges for ${processed} sellers` });
  } catch (error) {
    logger.error("Batch recalculate error", { error });
    return res.status(500).json({ error: "Failed to batch recalculate" });
  }
}));

export default router;
