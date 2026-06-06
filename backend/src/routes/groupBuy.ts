import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest, authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { sendWhatsApp } from "../services/whatsapp";
import { sendSMS } from "../services/sms";
import { logger } from "../lib/logger";
import crypto from "crypto";

const router = Router();

// GET /api/social/group-buy - List active group buys
router.get("/group-buy", asyncHandler(async (_req, res) => {
  try {
    const groupBuys = await prisma.groupBuy.findMany({
      where: { 
        status: "active",
        expiresAt: { gt: new Date() },
      },
      include: {
        product: {
          select: { id: true, name: true, slug: true, price: true, images: { select: { url: true }, take: 1 }, stock: true },
        },
        participants: {
          select: { userId: true, joinedAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    res.json({
      groupBuys: groupBuys.map(gb => ({
        ...gb,
        spotsLeft: gb.targetCount - gb.currentCount,
        progress: Math.round((gb.currentCount / gb.targetCount) * 100),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch group buys" });
  }
}));

// GET /api/social/group-buy/:id - Get single group buy details
router.get("/group-buy/:id", asyncHandler(async (req, res) => {
  try {
    const groupBuy = await prisma.groupBuy.findUnique({
      where: { id: req.params.id },
      include: {
        product: {
          select: { id: true, name: true, slug: true, price: true, comparePrice: true, images: { select: { url: true }, take: 1 }, stock: true },
        },
        participants: {
          include: { user: { select: { name: true, avatarUrl: true } } },
        },
      },
    });

    if (!groupBuy) {
      return res.status(404).json({ error: "Group buy not found" });
    }

    res.json({
      groupBuy: {
        ...groupBuy,
        spotsLeft: groupBuy.targetCount - groupBuy.currentCount,
        progress: Math.round((groupBuy.currentCount / groupBuy.targetCount) * 100),
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch group buy" });
  }
}));

// POST /api/social/group-buy/:id/join - Join a group buy
router.post("/group-buy/:id/join", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const groupBuy = await prisma.groupBuy.findUnique({
      where: { id: req.params.id },
      include: { participants: true },
    });

    if (!groupBuy || groupBuy.status !== "active" || groupBuy.expiresAt < new Date()) {
      return res.status(400).json({ error: "Group buy is not active" });
    }

    if (groupBuy.currentCount >= groupBuy.targetCount) {
      return res.status(400).json({ error: "Group buy is full" });
    }

    const alreadyJoined = groupBuy.participants.some(p => p.userId === userId);
    if (alreadyJoined) {
      return res.status(400).json({ error: "Already joined this group buy" });
    }

    const isCompleting = groupBuy.currentCount + 1 >= groupBuy.targetCount;

    await prisma.$transaction([
      prisma.groupBuyParticipant.create({
        data: { groupBuyId: groupBuy.id, userId },
      }),
      prisma.groupBuy.update({
        where: { id: groupBuy.id },
        data: {
          currentCount: { increment: 1 },
          status: isCompleting ? "completed" : "active",
        },
      }),
    ]);

    // When group buy completes, create coupons and notify all participants
    if (isCompleting) {
      const completedGB = await prisma.groupBuy.findUnique({
        where: { id: groupBuy.id },
        include: {
          product: { select: { name: true, slug: true } },
          participants: {
            include: { user: { select: { id: true, phone: true, name: true, email: true } } },
          },
        },
      });

      if (completedGB) {
        for (const participant of completedGB.participants) {
          const couponCode = `GROUP-${completedGB.id.slice(-4)}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
          try {
            await prisma.coupon.create({
              data: {
                code: couponCode,
                description: `Group buy discount for ${completedGB.product.name}`,
                type: "PERCENTAGE",
                value: completedGB.discountPercent,
                usageLimit: 1,
                validFrom: new Date(),
                validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                active: true,
              },
            });

            const msg = `🎉 Your group buy for ${completedGB.product.name} is complete! Use code ${couponCode} for ${completedGB.discountPercent}% off. Valid for 7 days.`;
            if (participant.user.phone) {
              await sendWhatsApp({ to: participant.user.phone, text: msg });
              await sendSMS(participant.user.phone, msg);
            }
          } catch (err) {
            logger.error("Failed to create group buy coupon", { participantId: participant.id, error: err });
          }
        }
      }
    }

    res.json({ success: true, message: isCompleting ? "Group buy completed! Check your messages for your discount coupon." : "Joined group buy!" });
  } catch (err) {
    res.status(500).json({ error: "Failed to join group buy" });
  }
}));

// GET /api/social/group-buy/product/:productId - Get active group buy for a product
router.get("/group-buy/product/:productId", asyncHandler(async (req, res) => {
  try {
    const groupBuy = await prisma.groupBuy.findFirst({
      where: {
        productId: req.params.productId,
        status: "active",
        expiresAt: { gt: new Date() },
      },
      include: {
        participants: {
          include: { user: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!groupBuy) {
      return res.json({ groupBuy: null });
    }

    res.json({
      groupBuy: {
        ...groupBuy,
        spotsLeft: groupBuy.targetCount - groupBuy.currentCount,
        progress: Math.round((groupBuy.currentCount / groupBuy.targetCount) * 100),
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch group buy" });
  }
}));

export default router;
