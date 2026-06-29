import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errorHandler";

const router = Router();
router.use(authenticate, requireAdmin);

const SizeGuideSchema = z.object({
  name: z.string().min(1).max(200),
  content: z.string().min(1), // HTML content
});

// GET /api/admin/size-guides
router.get("/", asyncHandler(async (req: AuthRequest, res: Response) => {
  const guides = await prisma.sizeGuide.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return res.json({ guides });
}));

// POST /api/admin/size-guides
router.post("/", asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = SizeGuideSchema.parse(req.body);
  const guide = await prisma.sizeGuide.create({ data: body as any });
  return res.status(201).json({ guide });
}));

// PUT /api/admin/size-guides/:id
router.put("/:id", asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const body = SizeGuideSchema.parse(req.body);
  const guide = await prisma.sizeGuide.update({ where: { id }, data: body });
  return res.json({ guide });
}));

// DELETE /api/admin/size-guides/:id
router.delete("/:id", asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  await prisma.sizeGuide.delete({ where: { id } });
  return res.json({ message: "Size guide deleted" });
}));

export default router;
