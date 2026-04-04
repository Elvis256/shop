import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthRequest, authenticate } from "../middleware/auth";

const prisma = new PrismaClient();
const router = Router();

// POST /api/social/check-in - Daily check-in
router.post("/check-in", authenticate, async (req: AuthRequest, res: Response) => {
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
    console.error("Check-in error:", err);
    res.status(500).json({ error: "Failed to check in" });
  }
});

// GET /api/social/check-in/status - Get check-in status for today
router.get("/check-in/status", authenticate, async (req: AuthRequest, res: Response) => {
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
});

export default router;
