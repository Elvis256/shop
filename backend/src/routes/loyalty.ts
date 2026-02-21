import { Router, Response } from "express";
import { PrismaClient, LoyaltyTxType } from "@prisma/client";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

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
router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
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
    console.error("Get loyalty error:", error);
    res.status(500).json({ error: "Failed to fetch loyalty account" });
  }
});

// Get points history
router.get("/transactions", authenticate, async (req: AuthRequest, res: Response) => {
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
    console.error("Get transactions error:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// Redeem points
router.post("/redeem", authenticate, async (req: AuthRequest, res: Response) => {
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
    console.error("Redeem points error:", error);
    res.status(500).json({ error: "Failed to redeem points" });
  }
});

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
    console.error("Award points error:", error);
    return 0;
  }
};

export default router;
