import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

// GET /api/banners - Get active banners
router.get("/", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { position } = req.query;

    const now = new Date();

    const where: any = {
      isActive: true,
      OR: [
        { startDate: null, endDate: null },
        { startDate: { lte: now }, endDate: null },
        { startDate: null, endDate: { gte: now } },
        { startDate: { lte: now }, endDate: { gte: now } },
      ],
    };

    if (position) {
      where.position = position;
    }

    const banners = await prisma.banner.findMany({
      where,
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        title: true,
        subtitle: true,
        imageUrl: true,
        mobileImageUrl: true,
        linkUrl: true,
        buttonText: true,
        position: true,
      },
    });

    return res.json({ banners });
  } catch (error) {
    logger.error("Get banners error", { error });
    return res.status(500).json({ error: "Failed to fetch banners" });
  }
}));

// GET /api/banners/home - Get homepage banners (hero + secondary)
router.get("/home", asyncHandler(async (_req: Request, res: Response) => {
  try {
    const now = new Date();

    const where = {
      isActive: true,
      position: { in: ["home-hero", "home-secondary"] },
      OR: [
        { startDate: null, endDate: null },
        { startDate: { lte: now }, endDate: null },
        { startDate: null, endDate: { gte: now } },
        { startDate: { lte: now }, endDate: { gte: now } },
      ],
    };

    const banners = await prisma.banner.findMany({
      where,
      orderBy: [{ position: "asc" }, { sortOrder: "asc" }],
    });

    const heroBanners = banners.filter((b) => b.position === "home-hero");
    const secondaryBanners = banners.filter((b) => b.position === "home-secondary");

    return res.json({
      hero: heroBanners,
      secondary: secondaryBanners,
    });
  } catch (error) {
    logger.error("Get home banners error", { error });
    return res.status(500).json({ error: "Failed to fetch banners" });
  }
}));

export default router;
