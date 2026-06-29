import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest, authenticate } from "../middleware/auth";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

// POST /api/social/check-in - Daily check-in
router.post("/check-in", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if already checked in today
    const existing = await prisma.dailyCheckIn.findUnique({
      where: { userId_date: { userId, date: today } },
    });

    if (existing) {
      return res.json({ alreadyCheckedIn: true, checkIn: existing, message: "Already checked in today!" });
    }

    // Calculate streak
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const yesterdayCheckIn = await prisma.dailyCheckIn.findUnique({
      where: { userId_date: { userId, date: yesterday } },
    });

    const streak = yesterdayCheckIn ? yesterdayCheckIn.streak + 1 : 1;
    
    // Bonus points for streaks: 7-day = 50pts, 14-day = 100pts, 30-day = 200pts
    let bonus = 0;
    if (streak === 7) bonus = 50;
    else if (streak === 14) bonus = 100;
    else if (streak === 30) bonus = 200;
    else if (streak % 30 === 0) bonus = 200;

    const basePoints = 10;
    const totalPoints = basePoints + bonus;

    const checkIn = await prisma.dailyCheckIn.create({
      data: {
        userId,
        date: today,
        points: basePoints,
        streak,
        bonus,
      },
    });

    // Add points to loyalty account if it exists
    try {
      await prisma.loyaltyAccount.upsert({
        where: { userId },
        update: { points: { increment: totalPoints } },
        create: { userId, points: totalPoints, tier: "BRONZE" },
      });
    } catch { /* loyalty may not exist */ }

    res.json({
      checkIn,
      totalPoints,
      streak,
      bonus,
      message: bonus > 0
        ? `🎉 ${streak}-day streak! +${totalPoints} points (${bonus} bonus!)`
        : `✅ +${basePoints} points! ${streak}-day streak`,
    });
  } catch (err) {
    logger.error("Check-in error", { error: err });
    res.status(500).json({ error: "Failed to check in" });
  }
}));

// GET /api/social/check-in/status - Get check-in status for today
router.get("/check-in/status", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCheckIn = await prisma.dailyCheckIn.findUnique({
      where: { userId_date: { userId, date: today } },
    });

    // Get recent check-ins for calendar display (last 30 days)
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentCheckIns = await prisma.dailyCheckIn.findMany({
      where: { userId, date: { gte: thirtyDaysAgo } },
      orderBy: { date: "desc" },
    });

    // Get total points earned from check-ins
    const totalEarned = await prisma.dailyCheckIn.aggregate({
      where: { userId },
      _sum: { points: true, bonus: true },
    });

    res.json({
      checkedInToday: !!todayCheckIn,
      currentStreak: todayCheckIn?.streak || 0,
      recentCheckIns: recentCheckIns.map(c => ({
        date: c.date,
        points: c.points,
        streak: c.streak,
        bonus: c.bonus,
      })),
      totalPointsEarned: (totalEarned._sum.points || 0) + (totalEarned._sum.bonus || 0),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get check-in status" });
  }
}));

// GET /api/social/check-in/mystery-drops - Get mystery drops unlocked by streak
router.get("/check-in/mystery-drops", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const latestCheckIn = await prisma.dailyCheckIn.findFirst({
      where: { userId },
      orderBy: { date: "desc" },
    });

    // Check if the latest check-in is either today or yesterday (to keep the streak active)
    let currentStreak = 0;
    if (latestCheckIn) {
      const diffTime = Math.abs(today.getTime() - latestCheckIn.date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 1) {
        currentStreak = latestCheckIn.streak;
      }
    }

    const requiredStreak = 3;
    const isUnlocked = currentStreak >= requiredStreak;

    if (!isUnlocked) {
      return res.json({
        unlocked: false,
        currentStreak,
        requiredStreak,
        message: `Unlock exclusive daily "Mystery Drops" by maintaining a ${requiredStreak}-day check-in streak! Current streak: ${currentStreak} days.`,
        items: [],
      });
    }

    // Fetch products with the "mystery-drop" tag
    const products = await prisma.product.findMany({
      where: {
        status: "ACTIVE",
        tags: { has: "mystery-drop" },
      },
      include: {
        images: { take: 1, orderBy: { position: "asc" } },
      },
    });

    return res.json({
      unlocked: true,
      currentStreak,
      requiredStreak,
      items: products.map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: p.price,
        comparePrice: p.comparePrice,
        currency: p.currency,
        imageUrl: p.images[0]?.url || null,
        stock: p.stock,
      })),
    });
  } catch (err) {
    logger.error("Get mystery drops error", { error: err });
    res.status(500).json({ error: "Failed to fetch mystery drops" });
  }
}));

export default router;
