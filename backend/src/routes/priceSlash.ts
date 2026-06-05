import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest, authenticate } from "../middleware/auth";
import crypto from "crypto";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

// POST /api/social/price-slash - Start a price slash for a product
router.post("/price-slash", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ error: "productId required" });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Check for existing active slash by this user for this product
    const existing = await prisma.priceSlash.findFirst({
      where: { initiatorId: userId, productId, status: "active", expiresAt: { gt: new Date() } },
    });

    if (existing) {
      return res.json({ priceSlash: existing });
    }

    const originalPrice = Number(product.price);
    const minPrice = Math.round(originalPrice * 0.5); // minimum 50% off
    const slashAmount = Math.round(originalPrice * 0.05); // each slash = 5% of original
    const maxSlashes = 10;

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour window

    const slashCode = crypto.randomBytes(6).toString("hex");

    const priceSlash = await prisma.priceSlash.create({
      data: {
        productId,
        initiatorId: userId,
        slashCode,
        originalPrice,
        currentPrice: originalPrice,
        minPrice,
        slashAmount,
        maxSlashes,
        expiresAt,
      },
    });

    res.json({ priceSlash });
  } catch (err) {
    logger.error("Price slash error", { error: err });
    res.status(500).json({ error: "Failed to create price slash" });
  }
}));

// POST /api/social/price-slash/:code/slash - A friend slashes the price
router.post("/price-slash/:code/slash", asyncHandler(async (req, res) => {
  try {
    const { code } = req.params;
    const visitorIp = req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.ip || "unknown";

    const priceSlash = await prisma.priceSlash.findUnique({
      where: { slashCode: code },
      include: { product: { select: { name: true, slug: true, images: { select: { url: true }, take: 1 } } } },
    });

    if (!priceSlash || priceSlash.status !== "active" || priceSlash.expiresAt < new Date()) {
      return res.status(400).json({ error: "Price slash is not active or has expired" });
    }

    if (priceSlash.currentSlashes >= priceSlash.maxSlashes) {
      return res.status(400).json({ error: "Maximum slashes reached" });
    }

    // Check if this visitor already slashed
    const alreadySlashed = await prisma.priceSlasher.findUnique({
      where: { priceSlashId_visitorIp: { priceSlashId: priceSlash.id, visitorIp } },
    });

    if (alreadySlashed) {
      return res.json({ priceSlash, alreadySlashed: true, message: "You already helped slash this price!" });
    }

    const newPrice = Math.max(
      Number(priceSlash.minPrice),
      Number(priceSlash.currentPrice) - Number(priceSlash.slashAmount)
    );

    await prisma.$transaction([
      prisma.priceSlasher.create({
        data: { priceSlashId: priceSlash.id, visitorIp },
      }),
      prisma.priceSlash.update({
        where: { id: priceSlash.id },
        data: {
          currentPrice: newPrice,
          currentSlashes: { increment: 1 },
        },
      }),
    ]);

    res.json({
      priceSlash: {
        ...priceSlash,
        currentPrice: newPrice,
        currentSlashes: priceSlash.currentSlashes + 1,
      },
      slashApplied: true,
      amountSlashed: Number(priceSlash.slashAmount),
      message: `You slashed USh ${Number(priceSlash.slashAmount).toLocaleString()} off!`,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to slash price" });
  }
}));

// GET /api/social/price-slash/my - Get user's active price slashes (must be before /:code)
router.get("/price-slash/my", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const slashes = await prisma.priceSlash.findMany({
      where: { initiatorId: req.user!.id },
      include: {
        product: { select: { name: true, slug: true, images: { select: { url: true }, take: 1 }, price: true } },
        slashers: { select: { slashedAt: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    res.json({
      slashes: slashes.map((s) => ({
        ...s,
        savings: Number(s.originalPrice) - Number(s.currentPrice),
        savingsPercent: Math.round((1 - Number(s.currentPrice) / Number(s.originalPrice)) * 100),
        slashesRemaining: s.maxSlashes - s.currentSlashes,
        isExpired: s.expiresAt < new Date(),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch price slashes" });
  }
}));

// GET /api/social/price-slash/:code - Get price slash details
router.get("/price-slash/:code", asyncHandler(async (req, res) => {
  try {
    const priceSlash = await prisma.priceSlash.findUnique({
      where: { slashCode: req.params.code },
      include: {
        product: { select: { id: true, name: true, slug: true, price: true, images: { select: { url: true }, take: 1 } } },
        slashers: { select: { slashedAt: true } },
      },
    });

    if (!priceSlash) {
      return res.status(404).json({ error: "Price slash not found" });
    }

    res.json({
      priceSlash: {
        ...priceSlash,
        savings: Number(priceSlash.originalPrice) - Number(priceSlash.currentPrice),
        savingsPercent: Math.round((1 - Number(priceSlash.currentPrice) / Number(priceSlash.originalPrice)) * 100),
        slashesRemaining: priceSlash.maxSlashes - priceSlash.currentSlashes,
        isExpired: priceSlash.expiresAt < new Date(),
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch price slash" });
  }
}));

export default router;
