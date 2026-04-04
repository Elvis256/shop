import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest, requireAdmin } from "../middleware/auth";

const router = Router();

// POST /api/subscriptions — Subscribe to a product
router.post("/", authenticate, async (req: AuthRequest, res: Response) => {
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
    console.error("Create subscription error:", error);
    return res.status(500).json({ error: "Failed to create subscription" });
  }
});

// GET /api/subscriptions — List user's active subscriptions
router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
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
    console.error("Get subscriptions error:", error);
    return res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
});

// PUT /api/subscriptions/:id — Update subscription
router.put("/:id", authenticate, async (req: AuthRequest, res: Response) => {
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
    console.error("Update subscription error:", error);
    return res.status(500).json({ error: "Failed to update subscription" });
  }
});

// DELETE /api/subscriptions/:id — Cancel subscription
router.delete("/:id", authenticate, async (req: AuthRequest, res: Response) => {
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
    console.error("Cancel subscription error:", error);
    return res.status(500).json({ error: "Failed to cancel subscription" });
  }
});

// GET /api/subscriptions/admin/all — List all subscriptions (admin)
router.get("/admin/all", authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      include: {
        user: { select: { id: true, email: true, name: true } },
        product: { select: { name: true, slug: true, price: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ subscriptions });
  } catch (error) {
    console.error("Admin get subscriptions error:", error);
    return res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
});

export default router;
