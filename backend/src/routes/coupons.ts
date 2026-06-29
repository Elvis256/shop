import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import redis from "../lib/redis";
import { optionalAuth, authenticate, AuthRequest } from "../middleware/auth";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

// Rate limit coupon validation/apply to prevent brute-force code enumeration (10 req/min per IP)
async function couponRateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = (req.headers["x-forwarded-for"] as string || req.ip || "").split(",")[0].trim();
  const key = `rl:coupon:${ip}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60);
    if (count > 10) {
      return res.status(429).json({ error: "Too many coupon attempts. Please wait a moment." });
    }
  } catch {}
  next();
}

// Helper: Check per-user coupon usage
async function checkPerUserLimit(coupon: any, userEmail?: string, userId?: string): Promise<boolean> {
  if (!coupon.perUserLimit) return true; // No per-user limit
  if (!userEmail && !userId) return true; // Guest checkout, can't track

  const where: any = { couponId: coupon.id };
  if (userId) {
    where.userId = userId;
  } else if (userEmail) {
    where.customerEmail = userEmail;
  }
  const userUsageCount = await prisma.order.count({ where });
  return userUsageCount < coupon.perUserLimit;
}

// GET /api/coupons/validate
router.get("/validate", couponRateLimit, optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { code, amount } = req.query;

    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Coupon code required" });
    }

    const upperCode = code.toUpperCase();

    const coupon = await prisma.coupon.findUnique({
      where: { code: upperCode },
    });

    if (!coupon) {
      return res.status(404).json({ error: "Invalid coupon code" });
    }

    if (!coupon.active) {
      return res.status(400).json({ error: "Coupon is no longer active" });
    }

    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validUntil) {
      return res.status(400).json({ error: "Coupon has expired" });
    }

    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ error: "Coupon usage limit reached" });
    }

    // Per-user limit check
    if (coupon.perUserLimit && req.user?.id) {
      const allowed = await checkPerUserLimit(coupon, req.user.email, req.user.id);
      if (!allowed) {
        return res.status(400).json({ error: "You have already used this coupon the maximum number of times" });
      }
    }

    const orderAmount = parseFloat(amount as string) || 0;
    if (coupon.minOrderAmount && orderAmount < Number(coupon.minOrderAmount)) {
      return res.status(400).json({
        error: `Minimum order amount is UGX ${Number(coupon.minOrderAmount).toLocaleString()}`,
      });
    }

    // Calculate discount
    let discount = 0;
    if (coupon.type === "PERCENTAGE") {
      discount = orderAmount * (Number(coupon.value) / 100);
      if (coupon.maxDiscount && discount > Number(coupon.maxDiscount)) {
        discount = Number(coupon.maxDiscount);
      }
    } else {
      discount = Number(coupon.value);
    }
    // Cap discount to order amount to prevent negative totals
    discount = Math.min(discount, orderAmount);

    return res.json({
      valid: true,
      coupon: {
        code: coupon.code,
        description: coupon.description,
        type: coupon.type,
        value: coupon.value,
        discount: Math.round(discount * 100) / 100,
      },
    });
  } catch (error) {
    logger.error("Validate coupon error", { error });
    return res.status(500).json({ error: "Validation failed" });
  }
}));

// POST /api/coupons/apply (used during checkout)
router.post("/apply", couponRateLimit, optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      code: z.string(),
      cartId: z.string().optional(),
      amount: z.number().positive(),
    });

    const body = schema.parse(req.body);

    const upperCode = body.code.toUpperCase();

    const coupon = await prisma.coupon.findUnique({
      where: { code: upperCode },
    });

    if (!coupon || !coupon.active) {
      return res.status(400).json({ error: "Invalid coupon code" });
    }

    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validUntil) {
      return res.status(400).json({ error: "Coupon has expired" });
    }

    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ error: "Coupon usage limit reached" });
    }

    if (coupon.minOrderAmount && body.amount < Number(coupon.minOrderAmount)) {
      return res.status(400).json({
        error: `Minimum order amount is UGX ${Number(coupon.minOrderAmount).toLocaleString()}`,
      });
    }

    // Calculate discount
    let discount = 0;
    if (coupon.type === "PERCENTAGE") {
      discount = body.amount * (Number(coupon.value) / 100);
      if (coupon.maxDiscount && discount > Number(coupon.maxDiscount)) {
        discount = Number(coupon.maxDiscount);
      }
    } else {
      discount = Number(coupon.value);
    }
    // Cap discount to order amount to prevent negative totals
    discount = Math.min(discount, body.amount);

    return res.json({
      applied: true,
      couponId: coupon.id,
      discount: Math.round(discount * 100) / 100,
      newTotal: Math.round((body.amount - discount) * 100) / 100,
    });
  } catch (error) {
    logger.error("Apply coupon error", { error });
    return res.status(500).json({ error: "Failed to apply coupon" });
  }
}));

export default router;
