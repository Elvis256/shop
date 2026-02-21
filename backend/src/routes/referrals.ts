import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, AuthRequest } from "../middleware/auth";
import crypto from "crypto";

const router = Router();
const prisma = new PrismaClient();

// Referral reward amounts
const REFERRER_REWARD = 500; // KES discount for referrer
const REFEREE_DISCOUNT = 10; // 10% off first order

// Generate unique referral code
const generateReferralCode = (userId: string) => {
  const hash = crypto.createHash("sha256").update(userId + Date.now()).digest("hex");
  return `REF${hash.slice(0, 8).toUpperCase()}`;
};

// Get or create referral code
router.get("/code", authenticate, async (req: AuthRequest, res: Response) => {
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
    console.error("Get referral code error:", error);
    res.status(500).json({ error: "Failed to get referral code" });
  }
});

// Apply referral code during signup
router.post("/apply", authenticate, async (req: AuthRequest, res: Response) => {
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
    console.error("Apply referral error:", error);
    res.status(500).json({ error: "Failed to apply referral code" });
  }
});

// Check referral code validity (public)
router.get("/check/:code", async (req, res) => {
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
    console.error("Check referral error:", error);
    res.status(500).json({ error: "Failed to check referral code" });
  }
});

// Process referral reward when referee makes first order
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

    // Update referral to qualified
    await prisma.$transaction([
      prisma.referral.update({
        where: { id: referral.id },
        data: {
          status: "QUALIFIED",
          firstOrderId: orderId,
          firstOrderAt: new Date(),
        },
      }),
      // Create reward coupon for referrer
      prisma.coupon.create({
        data: {
          code: `THANKS-${referral.referralCode.code}-${Date.now().toString(36).toUpperCase()}`,
          description: `Referral reward - Thank you for referring a friend!`,
          type: "FIXED",
          value: REFERRER_REWARD,
          usageLimit: 1,
          validFrom: new Date(),
          validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
          active: true,
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
    console.error("Process referral reward error:", error);
    return null;
  }
};

export default router;
