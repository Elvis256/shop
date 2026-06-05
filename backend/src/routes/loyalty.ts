import { Router, Response } from "express";
import { LoyaltyTxType } from "@prisma/client";
import { authenticate, AuthRequest, requireAdmin } from "../middleware/auth";
import prisma from "../lib/prisma";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

// Points earning rates
const POINTS_PER_CURRENCY = 0.01; // 1 point per 100 KES spent
const SIGNUP_BONUS = 100;
const REFERRAL_BONUS = 200;

// Tier thresholds (lifetime points)
const TIER_THRESHOLDS = {
  BRONZE: 0,
  SILVER: 1000,
  GOLD: 5000,
  PLATINUM: 15000,
};

// Get or create loyalty account
const getOrCreateAccount = async (userId: string) => {
  let account = await prisma.loyaltyAccount.findUnique({
    where: { userId },
  });

  if (!account) {
    account = await prisma.loyaltyAccount.create({
      data: {
        userId,
        points: SIGNUP_BONUS,
        lifetimePoints: SIGNUP_BONUS,
        transactions: {
          create: {
            type: "SIGNUP_BONUS",
            points: SIGNUP_BONUS,
            description: "Welcome bonus for joining!",
          },
        },
      },
    });
  }

  return account;
};

// Calculate tier based on lifetime points
const calculateTier = (lifetimePoints: number) => {
  if (lifetimePoints >= TIER_THRESHOLDS.PLATINUM) return "PLATINUM";
  if (lifetimePoints >= TIER_THRESHOLDS.GOLD) return "GOLD";
  if (lifetimePoints >= TIER_THRESHOLDS.SILVER) return "SILVER";
  return "BRONZE";
};

// Get loyalty account
router.get("/", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const account = await getOrCreateAccount(userId);

    // Get recent transactions
    const transactions = await prisma.loyaltyTransaction.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Calculate points value (100 points = 1 KES discount)
    const pointsValue = Math.floor(account.points / 100);

    res.json({
      account: {
        ...account,
        pointsValue,
        nextTier: account.tier === "PLATINUM" ? null : {
          name: calculateTier(account.lifetimePoints + 1000),
          pointsNeeded: TIER_THRESHOLDS[calculateTier(account.lifetimePoints + 1000)] - account.lifetimePoints,
        },
      },
      transactions,
      tiers: TIER_THRESHOLDS,
    });
  } catch (error) {
    logger.error("Get loyalty error", { error });
    res.status(500).json({ error: "Failed to fetch loyalty account" });
  }
}));

// Alias: /balance — used by checkout page
router.get("/balance", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const account = await getOrCreateAccount(userId);
    const pointsValue = Math.floor(account.points / 100);
    res.json({
      account: { ...account, pointsValue },
    });
  } catch (error) {
    logger.error("Get loyalty balance error", { error });
    res.status(500).json({ error: "Failed to fetch loyalty balance" });
  }
}));

// Get points history
router.get("/transactions", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const account = await prisma.loyaltyAccount.findUnique({
      where: { userId },
    });

    if (!account) {
      return res.json({ transactions: [] });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      prisma.loyaltyTransaction.findMany({
        where: { accountId: account.id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.loyaltyTransaction.count({
        where: { accountId: account.id },
      }),
    ]);

    res.json({
      transactions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error("Get transactions error", { error });
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
}));

// Redeem points
router.post("/redeem", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { points } = req.body;

    if (!points || points < 100) {
      return res.status(400).json({ error: "Minimum 100 points required for redemption" });
    }

    const account = await prisma.loyaltyAccount.findUnique({
      where: { userId },
    });

    if (!account || account.points < points) {
      return res.status(400).json({ error: "Insufficient points" });
    }

    // Calculate discount value
    const discountValue = Math.floor(points / 100);

    // Create a coupon for the user
    const couponCode = `LOYALTY-${userId.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    
    const [updatedAccount, coupon] = await prisma.$transaction([
      prisma.loyaltyAccount.update({
        where: { userId },
        data: {
          points: { decrement: points },
          transactions: {
            create: {
              type: "REDEMPTION",
              points: -points,
              description: `Redeemed ${points} points for KES ${discountValue} discount`,
            },
          },
        },
      }),
      prisma.coupon.create({
        data: {
          code: couponCode,
          description: `Loyalty points redemption - ${points} points`,
          type: "FIXED",
          value: discountValue,
          usageLimit: 1,
          validFrom: new Date(),
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          active: true,
        },
      }),
    ]);

    res.json({
      message: "Points redeemed successfully",
      coupon: {
        code: coupon.code,
        value: discountValue,
        validUntil: coupon.validUntil,
      },
      remainingPoints: updatedAccount.points,
    });
  } catch (error) {
    logger.error("Redeem points error", { error });
    res.status(500).json({ error: "Failed to redeem points" });
  }
}));

// Award points for purchase (called internally)
export const awardPurchasePoints = async (userId: string, orderTotal: number, orderId: string) => {
  try {
    const account = await getOrCreateAccount(userId);
    const pointsEarned = Math.floor(orderTotal * POINTS_PER_CURRENCY);

    if (pointsEarned > 0) {
      const newLifetimePoints = account.lifetimePoints + pointsEarned;
      const newTier = calculateTier(newLifetimePoints);

      await prisma.loyaltyAccount.update({
        where: { userId },
        data: {
          points: { increment: pointsEarned },
          lifetimePoints: newLifetimePoints,
          tier: newTier,
          transactions: {
            create: {
              type: "PURCHASE_EARN",
              points: pointsEarned,
              description: `Earned from order`,
              orderId,
            },
          },
        },
      });
    }

    return pointsEarned;
  } catch (error) {
    logger.error("Award points error", { error });
    return 0;
  }
};

// POST /api/loyalty/admin/multiplier — Set a global points multiplier event (admin)
router.post("/admin/multiplier", authenticate, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { multiplier, endsAt, description } = req.body;

    if (!multiplier || !endsAt || !description) {
      return res.status(400).json({ error: "multiplier, endsAt, and description are required" });
    }

    if (typeof multiplier !== "number" || multiplier < 1) {
      return res.status(400).json({ error: "multiplier must be a number >= 1" });
    }

    const value = JSON.stringify({ multiplier, endsAt, description });

    await prisma.setting.upsert({
      where: { key: "loyalty_multiplier" },
      update: { value },
      create: { key: "loyalty_multiplier", value },
    });

    return res.json({ message: "Points multiplier set", multiplier, endsAt, description });
  } catch (error) {
    logger.error("Set loyalty multiplier error", { error });
    return res.status(500).json({ error: "Failed to set multiplier" });
  }
}));

// GET /api/loyalty/admin/accounts — List all loyalty accounts (admin)
router.get("/admin/accounts", authenticate, requireAdmin, asyncHandler(async (_req: AuthRequest, res: Response) => {
  try {
    const accounts = await prisma.loyaltyAccount.findMany({
      include: {
        user: { select: { name: true, email: true } },
        transactions: { orderBy: { createdAt: "desc" }, take: 5 },
      },
      orderBy: { lifetimePoints: "desc" },
    });
    res.json(accounts);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}));

// POST /api/loyalty/admin/adjust — Manually adjust points (admin)
router.post("/admin/adjust", authenticate, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { userId, points, description } = req.body;
    if (!userId || points === undefined || !description) {
      return res.status(400).json({ error: "userId, points, and description required" });
    }
    const account = await prisma.loyaltyAccount.findUnique({ where: { userId } });
    if (!account) return res.status(404).json({ error: "Loyalty account not found" });

    const [updatedAccount, tx] = await prisma.$transaction([
      prisma.loyaltyAccount.update({
        where: { userId },
        data: {
          points: { increment: points },
          lifetimePoints: points > 0 ? { increment: points } : undefined,
        },
      }),
      prisma.loyaltyTransaction.create({
        data: {
          accountId: account.id,
          type: "ADJUSTMENT",
          points,
          description,
        },
      }),
    ]);
    res.json({ account: updatedAccount, transaction: tx });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}));

// GET /api/loyalty/admin/stats — Program stats (admin)
router.get("/admin/stats", authenticate, requireAdmin, asyncHandler(async (_req: AuthRequest, res: Response) => {
  try {
    const totalMembers = await prisma.loyaltyAccount.count();
    const pointsCirculation = await prisma.loyaltyAccount.aggregate({ _sum: { points: true } });
    const pointsRedeemed = await prisma.loyaltyTransaction.aggregate({
      where: { type: "REDEMPTION" },
      _sum: { points: true },
    });
    const tierCounts = await prisma.loyaltyAccount.groupBy({
      by: ["tier"],
      _count: true,
    });
    res.json({
      totalMembers,
      totalPointsCirculation: pointsCirculation._sum.points || 0,
      totalPointsRedeemed: Math.abs(pointsRedeemed._sum.points || 0),
      tierBreakdown: tierCounts.reduce((acc: any, t: any) => { acc[t.tier] = t._count; return acc; }, {}),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}));

// GET /api/loyalty/multiplier — Get current active multiplier
router.get("/multiplier", asyncHandler(async (_req: any, res: Response) => {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: "loyalty_multiplier" } });

    if (!setting) {
      return res.json({ active: false, multiplier: 1 });
    }

    const data = JSON.parse(setting.value);
    const isActive = new Date(data.endsAt) > new Date();

    return res.json({
      active: isActive,
      multiplier: isActive ? data.multiplier : 1,
      endsAt: data.endsAt,
      description: isActive ? data.description : null,
    });
  } catch (error) {
    logger.error("Get loyalty multiplier error", { error });
    return res.status(500).json({ error: "Failed to fetch multiplier" });
  }
}));

export default router;
