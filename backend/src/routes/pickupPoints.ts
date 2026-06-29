import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

router.get("/", asyncHandler(async (_req: Request, res: Response) => {
  const points = await prisma.pickupPoint.findMany({
    where: { isActive: true },
    orderBy: { city: "asc" },
  });
  res.json(points);
}));

router.get("/:id", asyncHandler(async (req: Request, res: Response) => {
  const point = await prisma.pickupPoint.findUnique({
    where: { id: req.params.id },
  });
  if (!point) return res.status(404).json({ error: "Pickup point not found" });
  res.json(point);
}));

export default router;
