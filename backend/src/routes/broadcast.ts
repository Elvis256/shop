import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest, requireAdmin } from "../middleware/auth";
import { sendWhatsApp } from "../services/whatsapp";
import { sendSMS } from "../services/sms";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

// POST /api/broadcast/whatsapp — Admin sends bulk WhatsApp/SMS to opted-in customers
router.post("/whatsapp", authenticate, requireAdmin, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const data = z.object({
      message: z.string().min(5).max(1000),
      channel: z.enum(["whatsapp", "sms", "both"]).default("whatsapp"),
      // Optional filters
      minOrderCount: z.number().int().min(0).default(0), // only customers with N+ orders
    }).parse(req.body);

    // Fetch opted-in customers with phone numbers
    const customers = await prisma.user.findMany({
      where: {
        smsOptIn: true,
        phone: { not: null },
        role: "CUSTOMER",
        ...(data.minOrderCount > 0 ? {
          orders: { some: { status: { in: ["DELIVERED", "CONFIRMED"] as any } } },
        } : {}),
      },
      select: { id: true, phone: true, name: true },
    });

    if (customers.length === 0) {
      return res.json({ sent: 0, message: "No opted-in customers found" });
    }

    let sent = 0;
    let failed = 0;

    // Rate limit: send in batches of 10 with 1s delay to avoid Meta limits
    const batchSize = 10;
    for (let i = 0; i < customers.length; i += batchSize) {
      const batch = customers.slice(i, i + batchSize);

      await Promise.allSettled(
        batch.map(async (customer) => {
          const phone = customer.phone!;
          let success = false;

          if (data.channel === "whatsapp" || data.channel === "both") {
            success = await sendWhatsApp({ to: phone, text: data.message });
          }

          if ((data.channel === "sms" || data.channel === "both") && !success) {
            success = await sendSMS(phone, data.message);
          }

          if (success) sent++;
          else failed++;
        })
      );

      // Small delay between batches
      if (i + batchSize < customers.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    // Log broadcast in settings for audit trail
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: "BROADCAST_SENT",
        entityType: "Broadcast",
        description: `Sent ${data.channel} broadcast to ${sent} customers`,
        metadata: { channel: data.channel, sent, failed, recipients: customers.length },
      },
    });

    return res.json({
      total: customers.length,
      sent,
      failed,
      message: `Broadcast sent to ${sent} customers`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    logger.error("Broadcast error", { error });
    return res.status(500).json({ error: "Failed to send broadcast" });
  }
}));

// GET /api/broadcast/audience — Preview how many will receive a broadcast
router.get("/audience", authenticate, requireAdmin, asyncHandler(async (_req: AuthRequest, res: Response) => {
  try {
    const total = await prisma.user.count({
      where: { smsOptIn: true, phone: { not: null }, role: "CUSTOMER" },
    });

    return res.json({ total, message: `${total} customers will receive your broadcast` });
  } catch (error) {
    return res.status(500).json({ error: "Failed to count audience" });
  }
}));

export default router;
