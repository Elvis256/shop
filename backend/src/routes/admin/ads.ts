import { Router, Response } from "express";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";

const router = Router();
router.use(authenticate, requireAdmin);

// GET /api/admin/ads/stats
router.get("/stats", async (_req: AuthRequest, res: Response) => {
  try {
    const [debitTxns, activeCampaigns, tierBreakdown] = await Promise.all([
      prisma.adTransaction.aggregate({
        where: { type: "DEBIT" },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.productPromotion.count({ where: { status: "ACTIVE" } }),
      prisma.productPromotion.groupBy({
        by: ["tier"],
        where: { status: { in: ["ACTIVE", "PAUSED", "EXPIRED"] } },
        _sum: { spent: true },
        _count: true,
      }),
    ]);

    // Revenue this month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthlyRevenue = await prisma.adTransaction.aggregate({
      where: { type: "DEBIT", createdAt: { gte: monthStart } },
      _sum: { amount: true },
    });

    return res.json({
      totalRevenue: Number(debitTxns._sum.amount || 0),
      totalCampaigns: debitTxns._count,
      activeCampaigns,
      monthlyRevenue: Number(monthlyRevenue._sum.amount || 0),
      revenueByTier: tierBreakdown.map((t) => ({
        tier: t.tier,
        spent: Number(t._sum.spent || 0),
        count: t._count,
      })),
    });
  } catch (error) {
    console.error("Admin ad stats error:", error);
    return res.status(500).json({ error: "Failed to fetch ad stats" });
  }
});

// GET /api/admin/ads/campaigns
router.get("/campaigns", async (req: AuthRequest, res: Response) => {
  try {
    const { status, page = "1", limit = "20" } = req.query;
    const take = Math.min(parseInt(limit as string) || 20, 100);
    const skip = (Math.max(parseInt(page as string) || 1, 1) - 1) * take;

    const where: any = {};
    if (status) where.status = status;

    const [campaigns, total] = await Promise.all([
      prisma.productPromotion.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
        include: {
          seller: { select: { id: true, storeName: true } },
          product: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.productPromotion.count({ where }),
    ]);

    return res.json({
      campaigns: campaigns.map((c) => ({
        id: c.id,
        sellerName: c.seller.storeName,
        sellerId: c.seller.id,
        productName: c.product.name,
        productSlug: c.product.slug,
        tier: c.tier,
        status: c.status,
        startDate: c.startDate,
        endDate: c.endDate,
        dailyRate: Number(c.dailyRate),
        totalBudget: Number(c.totalBudget),
        spent: Number(c.spent),
        createdAt: c.createdAt,
      })),
      pagination: {
        total,
        page: Math.floor(skip / take) + 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error("Admin ad campaigns error:", error);
    return res.status(500).json({ error: "Failed to fetch campaigns" });
  }
});

export default router;
