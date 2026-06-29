import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { logger } from "../lib/logger";

const router = Router();

// GET /api/audio-guides — Retrieve list of audio guides for the customer
router.get("/", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Fetch successful orders containing items to find purchased product IDs
    const paidOrders = await prisma.order.findMany({
      where: {
        userId,
        paymentStatus: "SUCCESSFUL",
      },
      include: {
        items: true,
      },
    });

    const purchasedProductIds = new Set<string>();
    paidOrders.forEach((order) => {
      order.items.forEach((item) => {
        if (item.productId) purchasedProductIds.add(item.productId);
      });
    });

    // Fetch all audio guides
    const guides = await prisma.audioGuide.findMany({
      orderBy: { createdAt: "desc" },
    });

    // Map guides, hide audioUrl if locked
    const formattedGuides = guides.map((guide) => {
      const isLocked = guide.productId ? !purchasedProductIds.has(guide.productId) : false;
      return {
        id: guide.id,
        title: guide.title,
        description: guide.description,
        duration: guide.duration,
        productId: guide.productId,
        createdAt: guide.createdAt,
        locked: isLocked,
        audioUrl: isLocked ? null : guide.audioUrl,
      };
    });

    return res.json({ guides: formattedGuides });
  } catch (error) {
    logger.error("Fetch audio guides error", { error });
    return res.status(500).json({ error: "Failed to fetch audio guides" });
  }
}));

// POST /api/audio-guides/admin — Create a new audio guide
router.post("/admin", authenticate, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const data = z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      audioUrl: z.string().url(),
      duration: z.number().int().min(1),
      productId: z.string().nullable().optional(),
    }).parse(req.body);

    const guide = await prisma.audioGuide.create({
      data: {
        title: data.title,
        description: data.description || null,
        audioUrl: data.audioUrl,
        duration: data.duration,
        productId: data.productId || null,
      },
    });

    return res.status(201).json({ message: "Audio guide created successfully", guide });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    logger.error("Create audio guide error", { error });
    return res.status(500).json({ error: "Failed to create audio guide" });
  }
}));

// DELETE /api/audio-guides/admin/:id — Delete an audio guide
router.delete("/admin/:id", authenticate, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.audioGuide.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Audio guide not found" });
    }

    await prisma.audioGuide.delete({ where: { id } });
    return res.json({ message: "Audio guide deleted successfully" });
  } catch (error) {
    logger.error("Delete audio guide error", { error });
    return res.status(500).json({ error: "Failed to delete audio guide" });
  }
}));

export default router;
