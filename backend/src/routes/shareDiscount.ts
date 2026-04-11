import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest, authenticate } from "../middleware/auth";
import crypto from "crypto";

const router = Router();

// POST /api/social/share - Create share link for a product
router.post("/share", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { productId, platform } = req.body;
    
    if (!productId || !platform) {
      return res.status(400).json({ error: "productId and platform required" });
    }

    // Check if user already shared this product
    const existing = await prisma.shareDiscount.findFirst({
      where: { userId, productId, couponUsed: false },
    });
    
    if (existing) {
      return res.json({ share: existing, message: "Share link already exists" });
    }

    const shareCode = crypto.randomBytes(6).toString("hex");
    const share = await prisma.shareDiscount.create({
      data: {
        userId,
        productId,
        platform,
        shareCode,
        discount: 10,
      },
    });

    res.json({ share });
  } catch (err) {
    console.error("Share discount error:", err);
    res.status(500).json({ error: "Failed to create share link" });
  }
});

// GET /api/social/share/:code/click - Track a click on shared link
router.get("/share/:code/click", async (req, res) => {
  try {
    const { code } = req.params;
    const share = await prisma.shareDiscount.findUnique({
      where: { shareCode: code },
    });
    
    if (!share) {
      return res.status(404).json({ error: "Share link not found" });
    }

    const updated = await prisma.shareDiscount.update({
      where: { id: share.id },
      data: { clicks: { increment: 1 } },
    });

    // Generate coupon after 3 clicks
    if (updated.clicks >= 3 && !updated.couponCode) {
      const couponCode = `SHARE-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
      await prisma.shareDiscount.update({
        where: { id: share.id },
        data: { couponCode },
      });
      return res.json({ share: { ...updated, couponCode }, couponUnlocked: true });
    }

    res.json({ share: updated, clicksNeeded: Math.max(0, 3 - updated.clicks) });
  } catch (err) {
    res.status(500).json({ error: "Failed to track click" });
  }
});

// GET /api/social/share/my - Get user's share discounts
router.get("/share/my", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const shares = await prisma.shareDiscount.findMany({
      where: { userId: req.user!.id },
      include: { product: { select: { name: true, slug: true, images: { select: { url: true }, take: 1 } } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    res.json({ shares });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch shares" });
  }
});

export default router;
