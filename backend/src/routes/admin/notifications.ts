import { Router, Response } from "express";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { asyncHandler } from "../../middleware/errorHandler";

const router = Router();

router.use(authenticate, requireAdmin);

// GET /api/admin/notifications — paginated list with filters
router.get("/", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const {
      event,
      channel,
      status,
      dateFrom,
      dateTo,
      search,
      page = "1",
      limit = "20",
    } = req.query;

    const take = Math.min(parseInt(limit as string) || 20, 100);
    const skip = (Math.max(parseInt(page as string) || 1, 1) - 1) * take;

    const where: any = {};

    if (event) where.event = event;
    if (channel) where.channel = channel;
    if (status) where.status = status;

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom as string);
      if (dateTo) where.createdAt.lte = new Date(dateTo as string);
    }

    if (search) {
      where.OR = [
        { recipient: { contains: search as string, mode: "insensitive" } },
        { subject: { contains: search as string, mode: "insensitive" } },
        { orderId: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.notificationLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.notificationLog.count({ where }),
    ]);

    return res.json({
      logs,
      pagination: {
        total,
        page: Math.floor(skip / take) + 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    logger.error("Admin get notification logs error", { error });
    return res.status(500).json({ error: "Failed to fetch notification logs" });
  }
}));

// GET /api/admin/notifications/stats — aggregate counts
router.get("/stats", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const [total, byStatus, byChannel] = await Promise.all([
      prisma.notificationLog.count(),
      prisma.notificationLog.groupBy({
        by: ["status"],
        _count: true,
      }),
      prisma.notificationLog.groupBy({
        by: ["channel"],
        _count: true,
      }),
    ]);

    const statusCounts = Object.fromEntries(byStatus.map((s) => [s.status, s._count]));
    const channelCounts = Object.fromEntries(byChannel.map((c) => [c.channel, c._count]));

    return res.json({
      total,
      success: statusCounts["SUCCESS"] || 0,
      failed: statusCounts["FAILED"] || 0,
      skipped: statusCounts["SKIPPED"] || 0,
      successRate: total > 0 ? Math.round(((statusCounts["SUCCESS"] || 0) / total) * 100) : 0,
      byChannel: channelCounts,
    });
  } catch (error) {
    logger.error("Admin get notification stats error", { error });
    return res.status(500).json({ error: "Failed to fetch notification stats" });
  }
}));

export default router;
