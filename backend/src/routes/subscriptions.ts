import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest, requireAdmin } from "../middleware/auth";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

// POST /api/subscriptions — Subscribe to a product
router.post("/", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { productId, quantity, intervalDays } = req.body;

    if (!productId || !quantity || ![14, 30, 60, 90].includes(intervalDays)) {
      return res.status(400).json({ error: "productId, quantity required; intervalDays must be 14, 30, 60, or 90" });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    if (!product.isSubscribable) {
      return res.status(400).json({ error: "This product is not available for subscription" });
    }

    const existing = await prisma.subscription.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (existing) {
      return res.status(400).json({ error: "You already have an active subscription for this product" });
    }

    const discount = product.subscriptionDiscount ? Number(product.subscriptionDiscount) : 0;

    const subscription = await prisma.subscription.create({
      data: {
        userId,
        productId,
        quantity,
        intervalDays,
        discount,
        nextDelivery: new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000),
        status: "ACTIVE",
      },
      include: { product: { select: { name: true, price: true, images: { take: 1, orderBy: { position: "asc" } } } } },
    });

    return res.status(201).json({ subscription });
  } catch (error) {
    logger.error("Create subscription error", { error });
    return res.status(500).json({ error: "Failed to create subscription" });
  }
}));

// GET /api/subscriptions — List user's active subscriptions
router.get("/", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const subscriptions = await prisma.subscription.findMany({
      where: { userId, status: { in: ["ACTIVE", "PAUSED"] } },
      include: {
        product: {
          select: { name: true, slug: true, price: true, images: { take: 1, orderBy: { position: "asc" } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ subscriptions });
  } catch (error) {
    logger.error("Get subscriptions error", { error });
    return res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
}));

// GET /api/subscriptions/admin/stats — Subscription stats (admin)
router.get("/admin/stats", authenticate, requireAdmin, asyncHandler(async (_req: AuthRequest, res: Response) => {
  try {
    const active = await prisma.subscription.count({ where: { status: "ACTIVE" } });
    const paused = await prisma.subscription.count({ where: { status: "PAUSED" } });
    const cancelled = await prisma.subscription.count({ where: { status: "CANCELLED" } });
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const upcomingDeliveries = await prisma.subscription.count({
      where: { status: "ACTIVE", nextDelivery: { lte: nextWeek } },
    });
    res.json({ active, paused, cancelled, upcomingDeliveries });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}));

// PUT /api/subscriptions/admin/:id — Admin update subscription
router.put("/admin/:id", authenticate, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { status, intervalDays, nextDelivery } = req.body;
    const updated = await prisma.subscription.update({
      where: { id: req.params.id },
      data: {
        ...(status && { status }),
        ...(intervalDays && { intervalDays }),
        ...(nextDelivery && { nextDelivery: new Date(nextDelivery) }),
      },
      include: {
        user: { select: { name: true, email: true } },
        product: { select: { name: true, price: true, images: { take: 1, select: { url: true } } } },
      },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}));

// PUT /api/subscriptions/:id — Update subscription
router.put("/:id", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { quantity, intervalDays, status } = req.body;

    const subscription = await prisma.subscription.findUnique({ where: { id } });
    if (!subscription) {
      return res.status(404).json({ error: "Subscription not found" });
    }
    if (subscription.userId !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const data: any = {};
    if (quantity && quantity > 0) data.quantity = quantity;
    if (intervalDays && [14, 30, 60, 90].includes(intervalDays)) {
      data.intervalDays = intervalDays;
      data.nextDelivery = new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000);
    }
    if (status === "PAUSED" || status === "ACTIVE") {
      data.status = status;
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data,
      include: { product: { select: { name: true, price: true } } },
    });

    return res.json({ subscription: updated });
  } catch (error) {
    logger.error("Update subscription error", { error });
    return res.status(500).json({ error: "Failed to update subscription" });
  }
}));

// DELETE /api/subscriptions/:id — Cancel subscription
router.delete("/:id", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const subscription = await prisma.subscription.findUnique({ where: { id } });
    if (!subscription) {
      return res.status(404).json({ error: "Subscription not found" });
    }
    if (subscription.userId !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await prisma.subscription.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    return res.json({ message: "Subscription cancelled" });
  } catch (error) {
    logger.error("Cancel subscription error", { error });
    return res.status(500).json({ error: "Failed to cancel subscription" });
  }
}));

// POST /api/subscriptions/:id/skip — Skip next delivery
router.post("/:id/skip", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const subscription = await prisma.subscription.findUnique({ where: { id } });
    if (!subscription) return res.status(404).json({ error: "Subscription not found" });
    if (subscription.userId !== userId) return res.status(403).json({ error: "Not authorized" });
    if (subscription.status !== "ACTIVE") return res.status(400).json({ error: "Subscription is not active" });

    // Advance nextDelivery by intervalDays
    const next = new Date(subscription.nextDelivery);
    const days = subscription.intervalDays || 30;
    next.setDate(next.getDate() + days);

    await prisma.subscription.update({
      where: { id },
      data: { nextDelivery: next },
    });

    return res.json({ message: "Next delivery skipped", nextDelivery: next.toISOString() });
  } catch (error) {
    logger.error("Skip subscription error", { error });
    return res.status(500).json({ error: "Failed to skip delivery" });
  }
}));

// GET /api/subscriptions/admin — List all subscriptions (admin) — alias for /admin/all
router.get("/admin", authenticate, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { status, search, page = "1", limit = "50" } = req.query;
    const take = Math.min(parseInt(limit as string) || 50, 200);
    const skip = (Math.max(parseInt(page as string) || 1, 1) - 1) * take;

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { user: { email: { contains: search as string, mode: "insensitive" } } },
        { user: { name: { contains: search as string, mode: "insensitive" } } },
        { product: { name: { contains: search as string, mode: "insensitive" } } },
      ];
    }

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, name: true, phone: true } },
          product: { select: { name: true, slug: true, price: true, images: { take: 1, select: { url: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.subscription.count({ where }),
    ]);

    return res.json({ subscriptions, total });
  } catch (error) {
    logger.error("Admin get subscriptions error", { error });
    return res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
}));

// DELETE /api/subscriptions/admin/:id — Admin cancel subscription
router.delete("/admin/:id", authenticate, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    await prisma.subscription.update({
      where: { id: req.params.id },
      data: { status: "CANCELLED" },
    });
    return res.json({ message: "Subscription cancelled" });
  } catch (error) {
    return res.status(500).json({ error: "Failed to cancel subscription" });
  }
}));

// GET /api/subscriptions/admin/all — List all subscriptions (admin)
router.get("/admin/all", authenticate, requireAdmin, asyncHandler(async (_req: AuthRequest, res: Response) => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      include: {
        user: { select: { id: true, email: true, name: true } },
        product: { select: { name: true, slug: true, price: true, images: { take: 1, select: { url: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ subscriptions });
  } catch (error) {
    logger.error("Admin get subscriptions error", { error });
    return res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
}));

export default router;
