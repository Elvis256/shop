import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

// GET /api/coupons/validate
router.get("/validate", async (req: Request, res: Response) => {
  try {
    const { code, amount } = req.query;

    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Coupon code required" });
    }

    const coupon = await prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
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

    const orderAmount = parseFloat(amount as string) || 0;
    if (coupon.minOrderAmount && orderAmount < Number(coupon.minOrderAmount)) {
      return res.status(400).json({
        error: `Minimum order amount is KES ${Number(coupon.minOrderAmount).toLocaleString()}`,
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
    console.error("Validate coupon error:", error);
    return res.status(500).json({ error: "Validation failed" });
  }
});

// POST /api/coupons/apply (used during checkout)
router.post("/apply", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      code: z.string(),
      cartId: z.string().optional(),
      amount: z.number().positive(),
    });

    const body = schema.parse(req.body);
    
    const coupon = await prisma.coupon.findUnique({
      where: { code: body.code.toUpperCase() },
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
        error: `Minimum order amount is KES ${Number(coupon.minOrderAmount).toLocaleString()}`,
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

    return res.json({
      applied: true,
      couponId: coupon.id,
      discount: Math.round(discount * 100) / 100,
      newTotal: Math.round((body.amount - discount) * 100) / 100,
    });
  } catch (error) {
    console.error("Apply coupon error:", error);
    return res.status(500).json({ error: "Failed to apply coupon" });
  }
});

export default router;
