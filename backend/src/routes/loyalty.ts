import { Router, Response } from "express";
import { LoyaltyTxType } from "@prisma/client";
import { authenticate, AuthRequest, requireAdmin } from "../middleware/auth";
import prisma from "../lib/prisma";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

// Points earning rates — tier-based multipliers
const TIER_EARN_RATES: Record<string, number> = {
  BRONZE: 0.01,    // 1 pt per 100 UGX
  SILVER: 0.015,   // 1.5 pt per 100 UGX
  GOLD: 0.02,      // 2 pt per 100 UGX
  PLATINUM: 0.03,  // 3 pt per 100 UGX
};
const SIGNUP_BONUS = 500;
const REFERRAL_BONUS = 200;
const POINTS_EXPIRY_MONTHS = 6;

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

    if (!points || points < 500) {
      return res.status(400).json({ error: "Minimum 500 points required for redemption" });
    }

    // Calculate discount value (100 points = 1 UGX)
    const discountValue = Math.floor(points / 100);

    // Safety cap: max 50,000 UGX per coupon (= 5,000,000 points)
    if (discountValue > 50000) {
      return res.status(400).json({ error: "Maximum redemption value is 50,000 UGX per coupon" });
    }
    const couponCode = `LOYALTY-${userId.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    // Atomic: read + check + update in a single transaction to prevent race conditions
    const result = await prisma.$transaction(async (tx) => {
      const account = await tx.loyaltyAccount.findUnique({ where: { userId } });
      if (!account || account.points < points) {
        throw Object.assign(new Error("Insufficient points"), { statusCode: 400 });
      }

      const updatedAccount = await tx.loyaltyAccount.update({
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
      });

      const coupon = await tx.coupon.create({
        data: {
          code: couponCode,
          description: `Loyalty points redemption - ${points} points`,
          type: "FIXED",
          value: discountValue,
          usageLimit: 1,
          validFrom: new Date(),
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          active: true,
        },
      });

      return { updatedAccount, coupon };
    });

    const { updatedAccount, coupon } = result;

    res.json({
      message: "Points redeemed successfully",
      coupon: {
        code: coupon.code,
        value: discountValue,
        validUntil: coupon.validUntil,
      },
      remainingPoints: updatedAccount.points,
    });
  } catch (error: any) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    logger.error("Redeem points error", { error });
    res.status(500).json({ error: "Failed to redeem points" });
  }
}));

// Award points for purchase (called internally — on delivery, not payment)
export const awardPurchasePoints = async (userId: string, orderTotal: number, orderId: string) => {
  try {
    // Duplicate guard: skip if PURCHASE_EARN already exists for this orderId
    const existing = await prisma.loyaltyTransaction.findFirst({
      where: { orderId, type: "PURCHASE_EARN" },
    });
    if (existing) {
      logger.info("loyalty_points_already_awarded", { userId, orderId });
      return 0;
    }

    const account = await getOrCreateAccount(userId);

    // Tier-based earn rate
    const tierRate = TIER_EARN_RATES[account.tier] || TIER_EARN_RATES.BRONZE;

    // Check for active admin multiplier
    let adminMultiplier = 1;
    try {
      const setting = await prisma.setting.findUnique({ where: { key: "loyalty_multiplier" } });
      if (setting) {
        const data = JSON.parse(setting.value);
        if (new Date(data.endsAt) > new Date()) {
          adminMultiplier = data.multiplier;
        }
      }
    } catch {}

    const pointsEarned = Math.floor(orderTotal * tierRate * adminMultiplier);

    if (pointsEarned > 0) {
      const newLifetimePoints = account.lifetimePoints + pointsEarned;
      const newTier = calculateTier(newLifetimePoints);

      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + POINTS_EXPIRY_MONTHS);

      const multiplierLabel = adminMultiplier > 1
        ? ` + ${adminMultiplier}x event`
        : "";
      const description = `Earned ${pointsEarned} pts from order (${account.tier} ${tierRate * 100}x${multiplierLabel})`;

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
              description,
              orderId,
              expiresAt,
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
