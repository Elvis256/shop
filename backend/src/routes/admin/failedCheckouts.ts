import { Router, Response } from "express";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { asyncHandler } from "../../middleware/errorHandler";

const router = Router();

router.use(authenticate, requireAdmin);

// GET /api/admin/failed-checkouts — paginated list of failed checkout attempts
router.get("/", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const filter = (req.query.filter as string) || "unack"; // "unack" | "all" | "ack"
    const skip = (page - 1) * limit;

    const where: any = { status: "FAILED" };
    if (filter === "unack") where.acknowledgedAt = null;
    else if (filter === "ack") where.acknowledgedAt = { not: null };

    const [items, total, stats] = await Promise.all([
      prisma.checkoutAttempt.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      }),
      prisma.checkoutAttempt.count({ where }),
      Promise.all([
        prisma.checkoutAttempt.count({ where: { status: "FAILED" } }),
        prisma.checkoutAttempt.count({ where: { status: "FAILED", acknowledgedAt: null } }),
        prisma.checkoutAttempt.count({
          where: {
            status: "FAILED",
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        }),
        prisma.checkoutAttempt.groupBy({
          by: ["failureCode"],
          where: { status: "FAILED", createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
          _count: { failureCode: true },
        }),
      ]).then(([total, unack, last24h, byCode]) => ({
        total,
        unacknowledged: unack,
        last24h,
        byCode: byCode.map((c) => ({ code: c.failureCode || "UNKNOWN", count: c._count.failureCode })),
      })),
    ]);

    return res.json({
      items,
      stats,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error("Admin failed-checkouts list error", { error });
    return res.status(500).json({ error: "Failed to fetch failed checkouts" });
  }
}));

// POST /api/admin/failed-checkouts/:id/acknowledge — mark as reviewed
router.post("/:id/acknowledge", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const attempt = await prisma.checkoutAttempt.findUnique({ where: { id: req.params.id } });
    if (!attempt) return res.status(404).json({ error: "Failed checkout not found" });
    if (attempt.status !== "FAILED") return res.status(400).json({ error: "Only FAILED attempts can be acknowledged" });

    await prisma.checkoutAttempt.update({
      where: { id: req.params.id },
      data: { acknowledgedAt: new Date(), acknowledgedBy: req.user?.id || null },
    });
    return res.json({ message: "Acknowledged" });
  } catch (error) {
    logger.error("Acknowledge failed checkout error", { error });
    return res.status(500).json({ error: "Failed to acknowledge" });
  }
}));

// POST /api/admin/failed-checkouts/acknowledge-all — bulk acknowledge unack items
router.post("/acknowledge-all", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const result = await prisma.checkoutAttempt.updateMany({
      where: { status: "FAILED", acknowledgedAt: null },
      data: { acknowledgedAt: new Date(), acknowledgedBy: req.user?.id || null },
    });
    return res.json({ message: "Acknowledged", count: result.count });
  } catch (error) {
    logger.error("Acknowledge-all failed checkouts error", { error });
    return res.status(500).json({ error: "Failed to acknowledge all" });
  }
}));

// GET /api/admin/failed-checkouts/badge — lightweight count for header badge
router.get("/badge", asyncHandler(async (_req: AuthRequest, res: Response) => {
  try {
    const count = await prisma.checkoutAttempt.count({
      where: { status: "FAILED", acknowledgedAt: null },
    });
    return res.json({ unacknowledged: count });
  } catch (error) {
    logger.error("Failed-checkouts badge error", { error });
    return res.json({ unacknowledged: 0 });
  }
}));

export default router;
