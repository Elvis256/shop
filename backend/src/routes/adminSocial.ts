import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest, authenticate } from "../middleware/auth";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

// Middleware: ensure admin
const adminOnly = async (req: AuthRequest, res: Response, next: any) => {
  if (req.user?.role !== "ADMIN") return res.status(403).json({ error: "Admin only" });
  next();
};

// ─── Dashboard Stats ─────────────────────────────────
router.get("/stats", authenticate, adminOnly, asyncHandler(async (_req, res) => {
  try {
    const [
      activeGroupBuys,
      totalGroupBuys,
      totalShares,
      shareClicks,
      activePriceSlashes,
      totalCheckIns,
      todayCheckIns,
    ] = await Promise.all([
      prisma.groupBuy.count({ where: { status: "active" } }),
      prisma.groupBuy.count(),
      prisma.shareDiscount.count(),
      prisma.shareDiscount.aggregate({ _sum: { clicks: true } }),
      prisma.priceSlash.count({ where: { status: "active" } }),
      prisma.dailyCheckIn.count(),
      prisma.dailyCheckIn.count({
        where: {
          date: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

    res.json({
      groupBuys: { active: activeGroupBuys, total: totalGroupBuys },
      shares: { total: totalShares, totalClicks: shareClicks._sum.clicks || 0 },
      priceSlashes: { active: activePriceSlashes },
      checkIns: { total: totalCheckIns, today: todayCheckIns },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch social stats" });
  }
}));

// ─── Group Buy CRUD ──────────────────────────────────
// List all group buys
router.get("/group-buys", authenticate, adminOnly, asyncHandler(async (req, res) => {
  try {
    const { status } = req.query;
    const where: any = {};
    if (status) where.status = status;

    const groupBuys = await prisma.groupBuy.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, slug: true, price: true, images: { take: 1, select: { url: true } } } },
        participants: { include: { user: { select: { name: true, email: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ groupBuys });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch group buys" });
  }
}));

// Create a group buy
router.post("/group-buys", authenticate, adminOnly, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { productId, targetCount, discountPercent, expiresInHours } = req.body;

    if (!productId || !targetCount || !discountPercent) {
      return res.status(400).json({ error: "productId, targetCount, and discountPercent required" });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return res.status(404).json({ error: "Product not found" });

    const groupPrice = Number(product.price) * (1 - discountPercent / 100);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (expiresInHours || 48));

    const groupBuy = await prisma.groupBuy.create({
      data: {
        productId,
        targetCount: Number(targetCount),
        discountPercent: Number(discountPercent),
        groupPrice,
        expiresAt,
      },
      include: {
        product: { select: { name: true, slug: true, price: true } },
      },
    });

    res.json({ groupBuy });
  } catch (err) {
    logger.error("Create group buy error", { error: err });
    res.status(500).json({ error: "Failed to create group buy" });
  }
}));

// Delete/cancel a group buy
router.delete("/group-buys/:id", authenticate, adminOnly, asyncHandler(async (req, res) => {
  try {
    await prisma.groupBuy.update({
      where: { id: req.params.id },
      data: { status: "expired" },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to cancel group buy" });
  }
}));

// ─── Share Discounts (read-only for admin) ───────────
router.get("/shares", authenticate, adminOnly, asyncHandler(async (_req, res) => {
  try {
    const shares = await prisma.shareDiscount.findMany({
      include: {
        user: { select: { name: true, email: true } },
        product: { select: { name: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ shares });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch shares" });
  }
}));

// ─── Price Slashes (read-only for admin) ─────────────
router.get("/price-slashes", authenticate, adminOnly, asyncHandler(async (_req, res) => {
  try {
    const slashes = await prisma.priceSlash.findMany({
      include: {
        initiator: { select: { name: true, email: true } },
        product: { select: { name: true, slug: true, price: true } },
        slashers: { select: { slashedAt: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ slashes });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch price slashes" });
  }
}));

// ─── Check-in Stats ──────────────────────────────────
router.get("/check-ins", authenticate, adminOnly, asyncHandler(async (_req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const dailyCounts = await prisma.dailyCheckIn.groupBy({
      by: ["date"],
      where: { date: { gte: sevenDaysAgo } },
      _count: true,
      orderBy: { date: "asc" },
    });

    // Top streak users
    const topStreaks = await prisma.dailyCheckIn.findMany({
      orderBy: { streak: "desc" },
      take: 10,
      distinct: ["userId"],
      include: { user: { select: { name: true, email: true } } },
    });

    res.json({
      dailyCounts: dailyCounts.map(d => ({ date: d.date, count: d._count })),
      topStreaks: topStreaks.map(s => ({
        userName: s.user.name || s.user.email,
        streak: s.streak,
        lastCheckIn: s.date,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch check-in stats" });
  }
}));

export default router;
