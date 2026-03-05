import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";

const router = Router();
router.use(authenticate, requireAdmin);

const zoneSchema = z.object({
  name: z.string().min(1),
  countries: z.array(z.string()).default([]),
  cities: z.array(z.string()).default([]),
  rate: z.number().min(0),
  currency: z.string().default("UGX"),
  freeAbove: z.number().nullable().optional(),
  estimatedDays: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
});

// GET /api/admin/shipping-zones
router.get("/", async (_req: AuthRequest, res: Response) => {
  try {
    const zones = await prisma.shippingZone.findMany({
      orderBy: { createdAt: "asc" },
    });
    return res.json({ zones });
  } catch (error) {
    console.error("Get shipping zones error:", error);
    return res.status(500).json({ error: "Failed to fetch shipping zones" });
  }
});

// POST /api/admin/shipping-zones
router.post("/", async (req: AuthRequest, res: Response) => {
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
    console.error("Create shipping zone error:", error);
    return res.status(500).json({ error: "Failed to create shipping zone" });
  }
});

// PATCH /api/admin/shipping-zones/:id
router.patch("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = zoneSchema.partial().parse(req.body);
    const zone = await prisma.shippingZone.update({ where: { id }, data });
    return res.json({ zone });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error("Update shipping zone error:", error);
    return res.status(500).json({ error: "Failed to update shipping zone" });
  }
});

// DELETE /api/admin/shipping-zones/:id
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.shippingZone.delete({ where: { id } });
    return res.json({ message: "Shipping zone deleted" });
  } catch (error) {
    console.error("Delete shipping zone error:", error);
    return res.status(500).json({ error: "Failed to delete shipping zone" });
  }
});

export default router;
