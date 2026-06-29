import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errorHandler";

const router = Router();
router.use(authenticate, requireAdmin);

const pickupPointSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  county: z.string().min(1),
  hours: z.string().min(1),
  phone: z.string().min(1),
  type: z.string().default("Agent"),
  isActive: z.boolean().default(true),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
});

// GET /api/admin/pickup-points — list all (active + inactive)
router.get("/", asyncHandler(async (_req: AuthRequest, res: Response) => {
  const points = await prisma.pickupPoint.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json(points);
}));

// POST /api/admin/pickup-points — create
router.post("/", asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = pickupPointSchema.parse(req.body);
  const point = await prisma.pickupPoint.create({ data: data as any });
  res.status(201).json(point);
}));

// PUT /api/admin/pickup-points/:id — update
router.put("/:id", asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = pickupPointSchema.partial().parse(req.body);
  const point = await prisma.pickupPoint.update({
    where: { id: req.params.id },
    data,
  });
  res.json(point);
}));

// DELETE /api/admin/pickup-points/:id — soft-delete (set isActive=false)
router.delete("/:id", asyncHandler(async (req: AuthRequest, res: Response) => {
  const point = await prisma.pickupPoint.update({
    where: { id: req.params.id },
    data: { isActive: false },
  });
  res.json(point);
}));

// POST /api/admin/pickup-points/seed — seed default pickup points if table is empty
router.post("/seed", asyncHandler(async (_req: AuthRequest, res: Response) => {
  const count = await prisma.pickupPoint.count();
  if (count > 0) {
    return res.json({ message: "Pickup points already exist", count });
  }

  const defaults = [
    { name: "Kampala Central Post Office", address: "Plot 35, Kampala Road", city: "Kampala", county: "Kampala", hours: "Mon-Sat 8:00 AM - 6:00 PM", phone: "+256 700 100 001", type: "Post Office" },
    { name: "Garden City Mall Pickup", address: "Yusuf Lule Road, Garden City Mall", city: "Kampala", county: "Kampala", hours: "Mon-Sun 9:00 AM - 9:00 PM", phone: "+256 700 100 002", type: "Mall Locker" },
    { name: "Acacia Mall Collection Point", address: "Acacia Avenue, Kololo", city: "Kampala", county: "Kampala", hours: "Mon-Sun 8:00 AM - 10:00 PM", phone: "+256 700 100 003", type: "Mall Locker" },
    { name: "Jinja Road Pickup Center", address: "Plot 12, Jinja Road", city: "Kampala", county: "Kampala", hours: "Mon-Fri 9:00 AM - 5:00 PM", phone: "+256 700 100 004", type: "Pickup Center" },
    { name: "Entebbe Town Agent", address: "Airport Road, near Total Petrol Station", city: "Entebbe", county: "Wakiso", hours: "Mon-Sat 8:00 AM - 7:00 PM", phone: "+256 700 100 005", type: "Agent" },
    { name: "Mukono Pickup Point", address: "Main Street, opposite Mukono Town Council", city: "Mukono", county: "Mukono", hours: "Mon-Sat 8:00 AM - 6:00 PM", phone: "+256 700 100 006", type: "Agent" },
    { name: "Jinja Central Agent", address: "Bell Avenue, Jinja Town", city: "Jinja", county: "Jinja", hours: "Mon-Sat 9:00 AM - 5:00 PM", phone: "+256 700 100 007", type: "Agent" },
    { name: "Mbarara Town Pickup", address: "High Street, near Mbarara University", city: "Mbarara", county: "Mbarara", hours: "Mon-Sat 9:00 AM - 6:00 PM", phone: "+256 700 100 008", type: "Agent" },
  ];

  await prisma.pickupPoint.createMany({ data: defaults });
  res.status(201).json({ message: "Seeded pickup points", count: defaults.length });
}));

export default router;
