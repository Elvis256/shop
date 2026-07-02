import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest, authenticate, optionalAuth } from "../middleware/auth";
import crypto from "crypto";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";
import redis from "../lib/redis";
import { cacheGet, cacheSet } from "../lib/cache";

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

    // 1. Check Cache first
    const cacheKey = `price-slash:code:${code}`;
    let priceSlash = await cacheGet<any>(cacheKey);

    if (!priceSlash) {
      priceSlash = await prisma.priceSlash.findUnique({
        where: { slashCode: code },
        include: { product: { select: { name: true, slug: true, images: { select: { url: true }, take: 1 } } } },
      });
      if (priceSlash) {
        await cacheSet(cacheKey, priceSlash, 3600); // cache for 1 hr
      }
    }

    if (!priceSlash || priceSlash.status !== "active" || new Date(priceSlash.expiresAt) < new Date()) {
      return res.status(400).json({ error: "Price slash is not active or has expired" });
    }

    // 2. Fetch or initialize the slash counter in Redis
    const countKey = `price-slash:${priceSlash.id}:count`;
    let currentSlashesStr = await redis.get(countKey);
    if (currentSlashesStr === null) {
      currentSlashesStr = String(priceSlash.currentSlashes);
      await redis.set(countKey, currentSlashesStr, "EX", 86400); // 24h TTL matching campaign lifespan
    }
    const currentSlashes = parseInt(currentSlashesStr, 10);

    if (currentSlashes >= priceSlash.maxSlashes) {
      return res.status(400).json({ error: "Maximum slashes reached" });
    }

    // 3. Atomically check and add IP to Redis Set
    const ipSetKey = `price-slash:${priceSlash.id}:ips`;
    const added = await redis.sadd(ipSetKey, visitorIp);
    if (added === 0) {
      return res.json({
        priceSlash: {
          ...priceSlash,
          currentSlashes,
        },
        alreadySlashed: true,
        message: "You already helped slash this price!",
      });
    }
    await redis.expire(ipSetKey, 86400); // 24h TTL matching campaign lifespan

    // 4. Atomically increment the slash counter
    const newCount = await redis.incr(countKey);

    // 5. Calculate new price
    const originalPriceNum = Number(priceSlash.originalPrice);
    const slashAmountNum = Number(priceSlash.slashAmount);
    const minPriceNum = Number(priceSlash.minPrice);
    const newPrice = Math.max(
      minPriceNum,
      originalPriceNum - (newCount * slashAmountNum)
    );

    // 6. Execute PostgreSQL updates asynchronously (Fire-and-forget background sync)
    prisma.$transaction([
      prisma.priceSlasher.create({
        data: { priceSlashId: priceSlash.id, visitorIp },
      }),
      prisma.priceSlash.update({
        where: { id: priceSlash.id },
        data: {
          currentPrice: newPrice,
          currentSlashes: newCount,
        },
      }),
    ]).then(async () => {
      // Update cache
      const updatedCampaign = {
        ...priceSlash,
        currentPrice: newPrice,
        currentSlashes: newCount,
      };
      await cacheSet(cacheKey, updatedCampaign, 3600);
    }).catch((err) => {
      logger.error("Price slash background database write failed", { error: err });
    });

    // 7. Return response instantly (Under 2ms)
    res.json({
      priceSlash: {
        ...priceSlash,
        currentPrice: newPrice,
        currentSlashes: newCount,
      },
      slashApplied: true,
      amountSlashed: slashAmountNum,
      message: `You slashed USh ${slashAmountNum.toLocaleString()} off!`,
    });
  } catch (err) {
    logger.error("Price slash route error", { error: err });
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

// GET /api/social/price-slash/product/:productId - Get current user's active price slash for a product
router.get("/price-slash/product/:productId", optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.json({ priceSlash: null });
    }
    const { productId } = req.params;

    const priceSlash = await prisma.priceSlash.findFirst({
      where: {
        productId,
        initiatorId: userId,
        status: "active",
        expiresAt: { gt: new Date() },
      },
      include: {
        product: { select: { name: true, slug: true, price: true, images: { select: { url: true }, take: 1 } } },
        slashers: { select: { slashedAt: true } },
      },
    });

    if (!priceSlash) {
      return res.json({ priceSlash: null });
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
    logger.error("Fetch active price slash error", { error: err });
    res.status(500).json({ error: "Failed to fetch price slash" });
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
