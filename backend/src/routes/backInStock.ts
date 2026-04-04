import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate, optionalAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// POST /api/notify/back-in-stock — Subscribe to back-in-stock notification
router.post(
  "/back-in-stock",
  optionalAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const schema = z.object({
        productId: z.string(),
        email: z.string().email(),
      });
      const { productId, email } = schema.parse(req.body);

      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, stock: true },
      });

      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      if (product.stock > 0) {
        return res.status(400).json({ error: "Product is currently in stock" });
      }

      // Prevent duplicate subscriptions
      const existing = await prisma.backInStockSub.findUnique({
        where: { productId_email: { productId, email } },
      });

      if (existing) {
        return res
          .status(400)
          .json({ error: "Already subscribed for this product" });
      }

      const sub = await prisma.backInStockSub.create({
        data: {
          productId,
          email,
          userId: req.user?.id ?? null,
        },
      });

      return res
        .status(201)
        .json({ message: "Subscribed for back-in-stock notification", id: sub.id });
    } catch (error) {
      console.error("Back-in-stock subscribe error:", error);
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      return res.status(500).json({ error: "Failed to subscribe" });
    }
  }
);

// GET /api/notify/back-in-stock/:productId — Check if current user/email is subscribed
router.get(
  "/back-in-stock/:productId",
  optionalAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { productId } = req.params;
      const email = req.query.email as string | undefined;

      if (!req.user && !email) {
        return res
          .status(400)
          .json({ error: "Email query param required for unauthenticated users" });
      }

      const where: any = { productId, notified: false };
      if (req.user) {
        where.userId = req.user.id;
      } else {
        where.email = email;
      }

      const sub = await prisma.backInStockSub.findFirst({ where });

      return res.json({ subscribed: !!sub });
    } catch (error) {
      console.error("Check back-in-stock sub error:", error);
      return res.status(500).json({ error: "Failed to check subscription" });
    }
  }
);

/**
 * Notify all unnotified subscribers for a product that is back in stock.
 * Logs emails for now since SMTP may not be configured.
 */
export async function notifyBackInStock(productId: string): Promise<number> {
  const subscribers = await prisma.backInStockSub.findMany({
    where: { productId, notified: false },
    include: { product: { select: { name: true } } },
  });

  if (subscribers.length === 0) return 0;

  for (const sub of subscribers) {
    // Log instead of sending email since SMTP may not work
    console.log(
      `[BackInStock] Would email ${sub.email}: "${sub.product.name}" is back in stock`
    );
  }

  await prisma.backInStockSub.updateMany({
    where: { productId, notified: false },
    data: { notified: true },
  });

  return subscribers.length;
}

export default router;
