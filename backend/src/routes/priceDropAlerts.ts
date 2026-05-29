import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { optionalAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// POST /api/price-alerts — Subscribe to price drop alert
router.post("/", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      productId: z.string(),
      targetPrice: z.number().positive(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    }).refine(data => data.email || data.phone, { message: "Email or phone required" });

    const body = schema.parse(req.body);

    const product = await prisma.product.findUnique({
      where: { id: body.productId },
      select: { id: true, price: true },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Check for existing alert
    if (body.email) {
      const existing = await prisma.priceDropAlert.findUnique({
        where: { productId_email: { productId: body.productId, email: body.email } },
      });
      if (existing) {
        // Update target price
        await prisma.priceDropAlert.update({
          where: { id: existing.id },
          data: { targetPrice: body.targetPrice, notified: false },
        });
        return res.json({ message: "Price alert updated" });
      }
    }

    if (body.phone) {
      const existing = await prisma.priceDropAlert.findUnique({
        where: { productId_phone: { productId: body.productId, phone: body.phone } },
      });
      if (existing) {
        await prisma.priceDropAlert.update({
          where: { id: existing.id },
          data: { targetPrice: body.targetPrice, notified: false },
        });
        return res.json({ message: "Price alert updated" });
      }
    }

    await prisma.priceDropAlert.create({
      data: {
        productId: body.productId,
        targetPrice: body.targetPrice,
        email: body.email,
        phone: body.phone,
        userId: req.user?.id,
      },
    });

    return res.status(201).json({ message: "Price alert set" });
  } catch (error) {
    console.error("Price alert create error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    return res.status(500).json({ error: "Failed to set price alert" });
  }
});

// GET /api/price-alerts/:productId — Check if current user is subscribed
router.get("/:productId", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { productId } = req.params;
    const email = req.query.email as string | undefined;
    const phone = req.query.phone as string | undefined;

    const where: any = { productId, notified: false };
    if (req.user) {
      where.userId = req.user.id;
    } else if (email) {
      where.email = email;
    } else if (phone) {
      where.phone = phone;
    } else {
      return res.json({ subscribed: false });
    }

    const alert = await prisma.priceDropAlert.findFirst({ where });
    return res.json({
      subscribed: !!alert,
      targetPrice: alert ? Number(alert.targetPrice) : null,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to check alert" });
  }
});

// DELETE /api/price-alerts/:id — Unsubscribe
router.delete("/:id", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.priceDropAlert.delete({ where: { id } });
    return res.json({ message: "Price alert removed" });
  } catch (error) {
    return res.status(500).json({ error: "Failed to remove alert" });
  }
});

/**
 * Check and notify subscribers when a product's price drops.
 * Call this from admin product update routes.
 */
export async function checkPriceDropAlerts(productId: string, newPrice: number): Promise<number> {
  const alerts = await prisma.priceDropAlert.findMany({
    where: {
      productId,
      notified: false,
      targetPrice: { gte: newPrice },
    },
    include: { product: { select: { name: true, slug: true } } },
  });

  if (alerts.length === 0) return 0;

  const { sendWhatsApp } = await import("../services/whatsapp");
  const { sendSMS } = await import("../services/sms");
  const baseUrl = process.env.FRONTEND_URL || "https://ugsex.com";

  for (const alert of alerts) {
    const message = `Great news! ${alert.product.name} dropped to UGX ${newPrice.toLocaleString()} (your target: UGX ${Number(alert.targetPrice).toLocaleString()}). Shop now: ${baseUrl}/product/${alert.product.slug}`;

    if (alert.phone) {
      sendWhatsApp({ to: alert.phone, text: message }).catch(() => {});
      sendSMS(alert.phone, message).catch(() => {});
    }
    if (alert.email) {
      console.log(`[PriceDrop] Would email ${alert.email}: ${message}`);
    }
  }

  await prisma.priceDropAlert.updateMany({
    where: { id: { in: alerts.map(a => a.id) } },
    data: { notified: true },
  });

  return alerts.length;
}

export default router;
