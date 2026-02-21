import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, AuthRequest } from "../middleware/auth";

const prisma = new PrismaClient();
const router = Router();

// All routes require admin authentication
router.use(authenticate);

// Middleware to check admin/manager role
const requireStaff = (req: AuthRequest, res: Response, next: Function) => {
  if (!["ADMIN", "MANAGER"].includes(req.user?.role || "")) {
    return res.status(403).json({ error: "Staff access required" });
  }
  next();
};

router.use(requireStaff);

// GET /api/admin/activity - List activity logs
router.get("/", async (req: Request, res: Response) => {
  try {
    const {
      page = "1",
      limit = "50",
      userId,
      action,
      entityType,
      startDate,
      endDate,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};

    if (userId) {
      where.userId = userId as string;
    }

    if (action) {
      where.action = action as string;
    }

    if (entityType) {
      where.entityType = entityType as string;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        (where.createdAt as Record<string, unknown>).gte = new Date(startDate as string);
      }
      if (endDate) {
        (where.createdAt as Record<string, unknown>).lte = new Date(endDate as string);
      }
    }

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.activityLog.count({ where }),
    ]);

    return res.json({
      logs: logs.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        description: log.description,
        metadata: log.metadata,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt,
        user: log.user,
      })),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("List activity logs error:", error);
    return res.status(500).json({ error: "Failed to fetch activity logs" });
  }
});

// GET /api/admin/activity/stats - Get activity statistics
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalToday,
      totalWeek,
      totalMonth,
      byAction,
      byEntityType,
      topUsers,
    ] = await Promise.all([
      prisma.activityLog.count({
        where: { createdAt: { gte: today } },
      }),
      prisma.activityLog.count({
        where: { createdAt: { gte: thisWeek } },
      }),
      prisma.activityLog.count({
        where: { createdAt: { gte: thisMonth } },
      }),
      prisma.activityLog.groupBy({
        by: ["action"],
        _count: true,
        where: { createdAt: { gte: thisMonth } },
      }),
      prisma.activityLog.groupBy({
        by: ["entityType"],
        _count: true,
        where: { createdAt: { gte: thisMonth } },
      }),
      prisma.activityLog.groupBy({
        by: ["userId"],
        _count: true,
        where: { createdAt: { gte: thisMonth } },
        orderBy: { _count: { userId: "desc" } },
        take: 5,
      }),
    ]);

    // Get user names for top users
    const userIds = topUsers.map((u) => u.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return res.json({
      summary: {
        today: totalToday,
        thisWeek: totalWeek,
        thisMonth: totalMonth,
      },
      byAction: byAction.map((a) => ({
        action: a.action,
        count: a._count,
      })),
      byEntityType: byEntityType.map((e) => ({
        entityType: e.entityType,
        count: e._count,
      })),
      topUsers: topUsers.map((u) => ({
        userId: u.userId,
        user: userMap.get(u.userId),
        count: u._count,
      })),
    });
  } catch (error) {
    console.error("Activity stats error:", error);
    return res.status(500).json({ error: "Failed to fetch activity stats" });
  }
});

// GET /api/admin/activity/entity/:type/:id - Get activity for specific entity
router.get("/entity/:type/:id", async (req: Request, res: Response) => {
  try {
    const { type, id } = req.params;
    const { limit = "20" } = req.query;

    const logs = await prisma.activityLog.findMany({
      where: {
        entityType: type,
        entityId: id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: parseInt(limit as string, 10),
    });

    return res.json({ logs });
  } catch (error) {
    console.error("Entity activity error:", error);
    return res.status(500).json({ error: "Failed to fetch entity activity" });
  }
});

export default router;
