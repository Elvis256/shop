import { Router, Response } from "express";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { asyncHandler } from "../../middleware/errorHandler";

const router = Router();

router.use(authenticate, requireAdmin);

// GET /api/admin/abandoned-carts — List abandoned carts with stats
router.get("/", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string; // "pending" | "reminded" | "recovered"
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status === "pending") {
      where.recoveredAt = null;
      where.email1SentAt = null;
    } else if (status === "reminded") {
      where.recoveredAt = null;
      where.email1SentAt = { not: null };
    } else if (status === "recovered") {
      where.recoveredAt = { not: null };
    }

    const [carts, total, stats] = await Promise.all([
      prisma.abandonedCart.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.abandonedCart.count({ where }),
      // Aggregate stats
      Promise.all([
        prisma.abandonedCart.count(),
        prisma.abandonedCart.count({ where: { recoveredAt: { not: null } } }),
        prisma.abandonedCart.count({ where: { email1SentAt: { not: null }, recoveredAt: null } }),
        prisma.abandonedCart.aggregate({
          _sum: { cartValue: true },
          where: { recoveredAt: null },
        }),
        prisma.abandonedCart.aggregate({
          _sum: { cartValue: true },
          where: { recoveredAt: { not: null } },
        }),
      ]).then(([totalCarts, recovered, reminded, lostValue, recoveredValue]) => ({
        total: totalCarts,
        recovered,
        reminded,
        pending: totalCarts - recovered - reminded,
        lostValue: Number(lostValue._sum.cartValue || 0),
        recoveredValue: Number(recoveredValue._sum.cartValue || 0),
        recoveryRate: totalCarts > 0 ? Math.round((recovered / totalCarts) * 100) : 0,
      })),
    ]);

    return res.json({
      carts,
      stats,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error("Admin abandoned carts error", { error });
    return res.status(500).json({ error: "Failed to fetch abandoned carts" });
  }
}));

// POST /api/admin/abandoned-carts/:id/send-reminder — Manually trigger reminder
router.post("/:id/send-reminder", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const cart = await prisma.abandonedCart.findUnique({
      where: { id: req.params.id },
    });

    if (!cart) {
      return res.status(404).json({ error: "Abandoned cart not found" });
    }

    if (cart.recoveredAt) {
      return res.status(400).json({ error: "Cart has already been recovered" });
    }

    // Mark as reminded (actual email sending handled by the cron service)
    if (!cart.email1SentAt) {
      await prisma.abandonedCart.update({
        where: { id: cart.id },
        data: { email1SentAt: new Date() },
      });
    }

    return res.json({ message: "Reminder queued" });
  } catch (error) {
    logger.error("Send reminder error", { error });
    return res.status(500).json({ error: "Failed to send reminder" });
  }
}));

// DELETE /api/admin/abandoned-carts/:id — Remove abandoned cart record
router.delete("/:id", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    await prisma.abandonedCart.delete({
      where: { id: req.params.id },
    });
    return res.json({ message: "Deleted" });
  } catch (error) {
    logger.error("Delete abandoned cart error", { error });
    return res.status(500).json({ error: "Failed to delete" });
  }
}));

export default router;
