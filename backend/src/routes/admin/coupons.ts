import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";

const router = Router();

router.use(authenticate, requireAdmin);

// GET /api/admin/coupons
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { active, page = "1", limit = "20" } = req.query;

    const take = Math.min(parseInt(limit as string) || 20, 100);
    const skip = (Math.max(parseInt(page as string) || 1, 1) - 1) * take;

    const where: any = {};
    if (active === "true") where.active = true;
    if (active === "false") where.active = false;

    const [coupons, total] = await Promise.all([
      prisma.coupon.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
        include: { _count: { select: { orders: true } } },
      }),
      prisma.coupon.count({ where }),
    ]);

    return res.json({
      coupons: coupons.map((c) => ({
        ...c,
        usageCount: c._count.orders,
      })),
      pagination: {
        total,
        page: Math.floor(skip / take) + 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error("Admin get coupons error:", error);
    return res.status(500).json({ error: "Failed to fetch coupons" });
  }
});

const CouponSchema = z.object({
  code: z.string().min(3).max(20),
  description: z.string().optional(),
  type: z.enum(["PERCENTAGE", "FIXED"]),
  value: z.number().positive(),
  minOrderAmount: z.number().positive().optional().nullable(),
  maxDiscount: z.number().positive().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
  validFrom: z.string().transform((s) => new Date(s)),
  validUntil: z.string().transform((s) => new Date(s)),
  active: z.boolean().default(true),
});

// POST /api/admin/coupons
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const body = CouponSchema.parse(req.body);

    // Check code uniqueness
    const existing = await prisma.coupon.findUnique({
      where: { code: body.code.toUpperCase() },
    });
    if (existing) {
      return res.status(400).json({ error: "Coupon code already exists" });
    }

    const coupon = await prisma.coupon.create({
      data: {
        ...body,
        code: body.code.toUpperCase(),
      },
    });

    return res.status(201).json({ message: "Coupon created", coupon });
  } catch (error) {
    console.error("Admin create coupon error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    return res.status(500).json({ error: "Failed to create coupon" });
  }
});

// PUT /api/admin/coupons/:id
router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const body = CouponSchema.partial().parse(req.body);

    const coupon = await prisma.coupon.findUnique({ where: { id } });
    if (!coupon) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    // Check code uniqueness if changing
    if (body.code && body.code.toUpperCase() !== coupon.code) {
      const existing = await prisma.coupon.findUnique({
        where: { code: body.code.toUpperCase() },
      });
      if (existing) {
        return res.status(400).json({ error: "Coupon code already exists" });
      }
    }

    const updated = await prisma.coupon.update({
      where: { id },
      data: {
        ...body,
        code: body.code?.toUpperCase(),
      },
    });

    return res.json({ message: "Coupon updated", coupon: updated });
  } catch (error) {
    console.error("Admin update coupon error:", error);
    return res.status(500).json({ error: "Failed to update coupon" });
  }
});

// DELETE /api/admin/coupons/:id
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const coupon = await prisma.coupon.findUnique({ where: { id } });
    if (!coupon) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    // Check if coupon is used
    const usedCount = await prisma.order.count({ where: { couponId: id } });
    if (usedCount > 0) {
      // Deactivate instead of delete
      await prisma.coupon.update({
        where: { id },
        data: { active: false },
      });
      return res.json({ message: "Coupon deactivated (has usage history)" });
    }

    await prisma.coupon.delete({ where: { id } });
    return res.json({ message: "Coupon deleted" });
  } catch (error) {
    console.error("Admin delete coupon error:", error);
    return res.status(500).json({ error: "Failed to delete coupon" });
  }
});

export default router;
