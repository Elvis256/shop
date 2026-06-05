import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest, requireAdmin } from "../middleware/auth";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

// GET /api/daily-deal — Get today's daily deal
router.get("/", asyncHandler(async (_req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const deal = await prisma.product.findFirst({
      where: {
        isDailyDeal: true,
        dailyDealDate: { gte: today, lt: tomorrow },
        status: "ACTIVE",
      },
      include: {
        images: { orderBy: { position: "asc" } },
        category: { select: { name: true, slug: true } },
      },
    });

    if (!deal) {
      return res.json({ deal: null });
    }

    return res.json({
      deal: {
        id: deal.id,
        name: deal.name,
        slug: deal.slug,
        description: deal.description,
        originalPrice: deal.price,
        dealPrice: deal.dailyDealPrice,
        currency: deal.currency,
        rating: deal.rating,
        reviewCount: deal.reviewCount,
        images: deal.images.map((img) => ({ url: img.url, alt: img.alt })),
        category: deal.category?.name || null,
        stock: deal.stock,
        endsAt: tomorrow.toISOString(),
      },
    });
  } catch (error) {
    logger.error("Get daily deal error", { error });
    return res.status(500).json({ error: "Failed to fetch daily deal" });
  }
}));

// GET /api/daily-deal/admin/all — List all daily deals (admin)
router.get("/admin/all", authenticate, requireAdmin, asyncHandler(async (_req: AuthRequest, res: Response) => {
  try {
    const deals = await prisma.product.findMany({
      where: { isDailyDeal: true },
      include: {
        images: { orderBy: { position: "asc" }, take: 1 },
        category: { select: { name: true } },
      },
      orderBy: { dailyDealDate: "desc" },
    });
    return res.json(deals);
  } catch (error) {
    logger.error("List daily deals error", { error });
    return res.status(500).json({ error: "Failed to list deals" });
  }
}));

// POST /api/daily-deal/admin/set — Set daily deal (admin)
router.post("/admin/set", authenticate, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { productId, dealPrice, date } = req.body;

    if (!productId || !dealPrice || !date) {
      return res.status(400).json({ error: "productId, dealPrice, and date are required" });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Clear previous daily deals for the same date
    const dealDate = new Date(date);
    dealDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(dealDate);
    nextDay.setDate(nextDay.getDate() + 1);

    await prisma.product.updateMany({
      where: {
        isDailyDeal: true,
        dailyDealDate: { gte: dealDate, lt: nextDay },
      },
      data: { isDailyDeal: false, dailyDealPrice: null, dailyDealDate: null },
    });

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        isDailyDeal: true,
        dailyDealPrice: dealPrice,
        dailyDealDate: dealDate,
      },
    });

    return res.json({ message: "Daily deal set", product: { id: updated.id, name: updated.name, dealPrice, date: dealDate } });
  } catch (error) {
    logger.error("Set daily deal error", { error });
    return res.status(500).json({ error: "Failed to set daily deal" });
  }
}));

// DELETE /api/daily-deal/admin/:id — Remove daily deal (admin)
router.delete("/admin/:id", authenticate, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.product.update({
      where: { id },
      data: { isDailyDeal: false, dailyDealPrice: null, dailyDealDate: null },
    });
    return res.json({ message: "Daily deal removed" });
  } catch (error) {
    logger.error("Delete daily deal error", { error });
    return res.status(500).json({ error: "Failed to remove deal" });
  }
}));

export default router;
