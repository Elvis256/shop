import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest, requireAdmin } from "../middleware/auth";
import crypto from "crypto";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

// Referral reward amounts
const REFERRER_REWARD = 500; // Loyalty points for referrer
const REFEREE_DISCOUNT = 10; // 10% off first order

// Generate unique referral code
const generateReferralCode = (userId: string) => {
  const hash = crypto.createHash("sha256").update(userId + Date.now()).digest("hex");
  return `REF${hash.slice(0, 8).toUpperCase()}`;
};

// Get or create referral code
router.get("/code", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    let referralCode = await prisma.referralCode.findUnique({
      where: { userId },
      include: {
        referrals: {
          include: {
            referredUser: {
              select: {
                name: true,
                createdAt: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!referralCode) {
      const newCode = await prisma.referralCode.create({
        data: {
          userId,
          code: generateReferralCode(userId),
        },
        include: {
          referrals: true,
        },
      });
      referralCode = {
        ...newCode,
        referrals: newCode.referrals.map(r => ({
          ...r,
          referredUser: { name: null, createdAt: r.createdAt },
        })),
      };
    }

    // Calculate stats
    const stats = {
      totalReferrals: referralCode.usageCount,
      qualifiedReferrals: referralCode.referrals.filter(r => r.status === "QUALIFIED" || r.status === "REWARDED").length,
      totalEarnings: Number(referralCode.totalEarnings),
    };

    res.json({
      code: referralCode.code,
      shareUrl: `${process.env.BASE_URL || "http://localhost:3000"}?ref=${referralCode.code}`,
      referrals: referralCode.referrals,
      stats,
      rewards: {
        referrerReward: REFERRER_REWARD,
        refereeDiscount: REFEREE_DISCOUNT,
      },
    });
  } catch (error) {
    logger.error("Get referral code error", { error });
    res.status(500).json({ error: "Failed to get referral code" });
  }
}));

// Apply referral code during signup
router.post("/apply", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { code } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!code) {
      return res.status(400).json({ error: "Referral code required" });
    }

    // Check if user was already referred
    const existingReferral = await prisma.referral.findUnique({
      where: { referredUserId: userId },
    });

    if (existingReferral) {
      return res.status(400).json({ error: "You have already used a referral code" });
    }

    // Find referral code
    const referralCode = await prisma.referralCode.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!referralCode) {
      return res.status(404).json({ error: "Invalid referral code" });
    }

    if (referralCode.userId === userId) {
      return res.status(400).json({ error: "You cannot refer yourself" });
    }

    // Create referral record
    await prisma.$transaction([
      prisma.referral.create({
        data: {
          referralCodeId: referralCode.id,
          referredUserId: userId,
        },
      }),
      prisma.referralCode.update({
        where: { id: referralCode.id },
        data: {
          usageCount: { increment: 1 },
        },
      }),
    ]);

    // Create discount coupon for referred user
    const couponCode = `WELCOME-${userId.slice(-6).toUpperCase()}`;
    await prisma.coupon.create({
      data: {
        code: couponCode,
        description: "Welcome discount from referral",
        type: "PERCENTAGE",
        value: REFEREE_DISCOUNT,
        usageLimit: 1,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        active: true,
      },
    });

    res.json({
      message: "Referral code applied successfully!",
      discount: {
        code: couponCode,
        value: REFEREE_DISCOUNT,
        type: "PERCENTAGE",
      },
    });
  } catch (error) {
    logger.error("Apply referral error", { error });
    res.status(500).json({ error: "Failed to apply referral code" });
  }
}));

// Check referral code validity (public)
router.get("/check/:code", asyncHandler(async (req, res) => {
  try {
    const { code } = req.params;

    const referralCode = await prisma.referralCode.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        user: {
          select: { name: true },
        },
      },
    });

    if (!referralCode) {
      return res.status(404).json({ valid: false, error: "Invalid referral code" });
    }

    res.json({
      valid: true,
      referrerName: referralCode.user.name?.split(" ")[0] || "A friend",
      discount: REFEREE_DISCOUNT,
    });
  } catch (error) {
    logger.error("Check referral error", { error });
    res.status(500).json({ error: "Failed to check referral code" });
  }
}));

// Process referral reward when referee makes first delivered order
// Awards loyalty points to the referrer instead of a coupon
export const processReferralReward = async (userId: string, orderId: string) => {
  try {
    const referral = await prisma.referral.findUnique({
      where: { referredUserId: userId },
      include: {
        referralCode: true,
      },
    });

    if (!referral || referral.status !== "PENDING") {
      return null;
    }

    const referrerId = referral.referralCode.userId;

    // Get or create referrer's loyalty account
    let referrerAccount = await prisma.loyaltyAccount.findUnique({ where: { userId: referrerId } });
    if (!referrerAccount) {
      referrerAccount = await prisma.loyaltyAccount.create({
        data: { userId: referrerId, points: 0, tier: "BRONZE" },
      });
    }

    await prisma.$transaction([
      prisma.referral.update({
        where: { id: referral.id },
        data: {
          status: "QUALIFIED",
          firstOrderId: orderId,
          firstOrderAt: new Date(),
        },
      }),
      // Award loyalty points to referrer
      prisma.loyaltyAccount.update({
        where: { userId: referrerId },
        data: {
          points: { increment: REFERRER_REWARD },
          lifetimePoints: { increment: REFERRER_REWARD },
        },
      }),
      prisma.loyaltyTransaction.create({
        data: {
          accountId: referrerAccount.id,
          type: "REFERRAL_BONUS",
          points: REFERRER_REWARD,
          description: `Referral reward — thank you for referring a friend!`,
        },
      }),
      prisma.referralCode.update({
        where: { id: referral.referralCodeId },
        data: {
          totalEarnings: { increment: REFERRER_REWARD },
        },
      }),
    ]);

    return REFERRER_REWARD;
  } catch (error) {
    logger.error("Process referral reward error", { error });
    return null;
  }
};

// GET /api/referrals/leaderboard — Top 10 referrers (public, anonymized)
router.get("/leaderboard", asyncHandler(async (_req, res) => {
  try {
    const topReferrers = await prisma.referralCode.findMany({
      where: { usageCount: { gt: 0 } },
      orderBy: { usageCount: "desc" },
      take: 10,
      include: {
        user: { select: { name: true } },
      },
    });

    const leaderboard = topReferrers.map((r, index) => {
      const name = r.user.name || "Anonymous";
      const parts = name.trim().split(/\s+/);
      const anonymized = parts.length > 1
        ? `${parts[0]} ${parts[parts.length - 1][0]}.`
        : `${parts[0]}`;

      return {
        rank: index + 1,
        name: anonymized,
        referralCount: r.usageCount,
      };
    });

    return res.json({ leaderboard });
  } catch (error) {
    logger.error("Get referral leaderboard error", { error });
    return res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
}));

// GET /api/referrals/admin/all — List all referral codes with referrals (admin)
router.get("/admin/all", authenticate, requireAdmin, asyncHandler(async (_req: AuthRequest, res: Response) => {
  try {
    const codes = await prisma.referralCode.findMany({
      include: {
        user: { select: { name: true, email: true } },
        referrals: {
          include: {
            referredUser: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { totalEarnings: "desc" },
    });
    res.json(codes);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}));

// GET /api/referrals/admin/stats — Referral program stats (admin)
router.get("/admin/stats", authenticate, requireAdmin, asyncHandler(async (_req: AuthRequest, res: Response) => {
  try {
    const totalCodes = await prisma.referralCode.count();
    const totalReferrals = await prisma.referral.count();
    const completed = await prisma.referral.count({ where: { status: "REWARDED" } });
    const totalPaid = await prisma.referral.aggregate({ where: { rewardPaid: true }, _sum: { rewardAmount: true } });
    const pendingPayouts = await prisma.referral.count({ where: { status: "REWARDED", rewardPaid: false } });
    res.json({
      totalCodes,
      totalReferrals,
      completedReferrals: completed,
      totalPaidOut: totalPaid._sum.rewardAmount || 0,
      pendingPayouts,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}));

// PUT /api/referrals/admin/:id/payout — Mark referral reward as paid (admin)
router.put("/admin/:id/payout", authenticate, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const updated = await prisma.referral.update({
      where: { id: req.params.id },
      data: { rewardPaid: true },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}));

export default router;
