import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { asyncHandler } from "../../middleware/errorHandler";

const router = Router();
router.use(authenticate, requireAdmin);

const weightTierSchema = z.object({
  maxKg: z.number().positive().nullable(),
  rate: z.number().min(0),
});

const zoneSchema = z.object({
  name: z.string().min(1),
  countries: z.array(z.string()).default([]),
  cities: z.array(z.string()).default([]),
  rate: z.number().min(0),
  currency: z.string().default("UGX"),
  freeAbove: z.number().nullable().optional(),
  estimatedDays: z.string().nullable().optional(),
  weightTiers: z.array(weightTierSchema).nullable().optional(),
  isActive: z.boolean().default(true),
});

// GET /api/admin/shipping-zones
router.get("/", asyncHandler(async (_req: AuthRequest, res: Response) => {
  try {
    const [zones, orderStats] = await Promise.all([
      prisma.shippingZone.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.order.aggregate({
        where: { status: { notIn: ["CANCELLED", "REFUNDED"] } },
        _sum: { shippingCost: true },
        _count: true,
      }),
    ]);

    const activeCount = zones.filter((z) => z.isActive).length;

    return res.json({
      zones,
      stats: {
        totalZones: zones.length,
        activeZones: activeCount,
        totalShippingRevenue: Number(orderStats._sum.shippingCost || 0),
        ordersWithShipping: orderStats._count,
      },
    });
  } catch (error) {
    logger.error("Get shipping zones error", { error });
    return res.status(500).json({ error: "Failed to fetch shipping zones" });
  }
}));

// POST /api/admin/shipping-zones
router.post("/", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const data = zoneSchema.parse(req.body);
    const zone = await prisma.shippingZone.create({
      data: {
        name: data.name,
        countries: data.countries,
        cities: data.cities,
        rate: data.rate,
        currency: data.currency,
        freeAbove: data.freeAbove ?? null,
        estimatedDays: data.estimatedDays ?? null,
        isActive: data.isActive,
      },
    });
    return res.status(201).json({ zone });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error("Create shipping zone error", { error });
    return res.status(500).json({ error: "Failed to create shipping zone" });
  }
}));

// PATCH /api/admin/shipping-zones/:id
router.patch("/:id", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = zoneSchema.partial().parse(req.body);
    const updateData: any = { ...data };
    // Prisma requires DbNull for JSON null
    if (data.weightTiers === null) {
      const { Prisma } = await import("@prisma/client");
      updateData.weightTiers = Prisma.DbNull;
    }
    const zone = await prisma.shippingZone.update({ where: { id }, data: updateData });
    return res.json({ zone });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error("Update shipping zone error", { error });
    return res.status(500).json({ error: "Failed to update shipping zone" });
  }
}));

// DELETE /api/admin/shipping-zones/:id
router.delete("/:id", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.shippingZone.delete({ where: { id } });
    return res.json({ message: "Shipping zone deleted" });
  } catch (error) {
    logger.error("Delete shipping zone error", { error });
    return res.status(500).json({ error: "Failed to delete shipping zone" });
  }
}));

// POST /api/admin/shipping-zones/calculate — Calculate shipping rate by weight + zone
router.post("/calculate", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { city, country, weightKg } = req.body;
    const zones = await prisma.shippingZone.findMany({ where: { isActive: true } });

    // Find best matching zone (city match > country match > first active)
    let zone = zones.find((z) =>
      z.cities.some((c) => c.toLowerCase() === (city || "").toLowerCase())
    );
    if (!zone) {
      zone = zones.find((z) =>
        z.countries.some((c) => c.toLowerCase() === (country || "").toLowerCase())
      );
    }
    if (!zone && zones.length > 0) {
      zone = zones[0];
    }
    if (!zone) {
      return res.json({ rate: 0, zone: null });
    }

    let rate = Number(zone.rate);

    // Apply weight tiers if configured and weight provided
    if (zone.weightTiers && weightKg && weightKg > 0) {
      const tiers = zone.weightTiers as Array<{ maxKg: number | null; rate: number }>;
      const sorted = [...tiers].sort((a, b) => (a.maxKg ?? Infinity) - (b.maxKg ?? Infinity));
      const matchedTier = sorted.find((t) => t.maxKg === null || weightKg <= t.maxKg);
      if (matchedTier) {
        rate = matchedTier.rate;
      }
    }

    return res.json({
      rate,
      zone: { id: zone.id, name: zone.name, estimatedDays: zone.estimatedDays },
      freeAbove: zone.freeAbove ? Number(zone.freeAbove) : null,
    });
  } catch (error) {
    logger.error("Calculate shipping error", { error });
    return res.status(500).json({ error: "Failed to calculate shipping" });
  }
}));

export default router;
