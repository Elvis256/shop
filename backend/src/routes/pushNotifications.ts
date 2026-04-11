import { Router, Request, Response } from "express";
import webpush from "web-push";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest, requireAdmin } from "../middleware/auth";

const router = Router();

// Generate VAPID keys if not set
let vapidPublicKey = process.env.VAPID_PUBLIC_KEY || "";
let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "";

if (!vapidPublicKey || !vapidPrivateKey) {
  const keys = webpush.generateVAPIDKeys();
  vapidPublicKey = keys.publicKey;
  vapidPrivateKey = keys.privateKey;
  // Log only the public key; private key must be set via .env
  console.warn("VAPID keys not configured. Generated temporary keys — set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env for production.");
}

webpush.setVapidDetails(
  `mailto:${process.env.FROM_EMAIL || "admin@example.com"}`,
  vapidPublicKey,
  vapidPrivateKey
);

export { vapidPublicKey };

// POST /api/push/subscribe — Save push subscription
router.post("/subscribe", async (req: Request, res: Response) => {
  try {
    const { endpoint, keys, userId } = req.body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: "endpoint and keys (p256dh, auth) are required" });
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { p256dh: keys.p256dh, auth: keys.auth, userId: userId || null },
      create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId: userId || null },
    });

    return res.status(201).json({ message: "Push subscription saved", vapidPublicKey });
  } catch (error) {
    console.error("Save push subscription error:", error);
    return res.status(500).json({ error: "Failed to save push subscription" });
  }
});

// POST /api/push/unsubscribe — Remove subscription by endpoint
router.post("/unsubscribe", async (req: Request, res: Response) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({ error: "endpoint is required" });
    }

    await prisma.pushSubscription.deleteMany({ where: { endpoint } });

    return res.json({ message: "Push subscription removed" });
  } catch (error) {
    console.error("Remove push subscription error:", error);
    return res.status(500).json({ error: "Failed to remove push subscription" });
  }
});

// POST /api/push/admin/send — Send push to all subscribers (admin)
router.post("/admin/send", authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { title, body, url } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: "title and body are required" });
    }

    const subscriptions = await prisma.pushSubscription.findMany({
      take: 1000,
      orderBy: { createdAt: "desc" },
    });
    const payload = JSON.stringify({ title, body, url: url || "/" });

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err: any) {
        failed++;
        // Remove invalid subscriptions (410 Gone or 404)
        if (err.statusCode === 410 || err.statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    }

    return res.json({ message: "Push notifications sent", sent, failed });
  } catch (error) {
    console.error("Send push notifications error:", error);
    return res.status(500).json({ error: "Failed to send push notifications" });
  }
});

// GET /api/push/admin/subscribers — List all push subscribers (admin)
router.get("/admin/subscribers", authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const subscribers = await prisma.pushSubscription.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(subscribers);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/push/admin/stats — Subscriber stats (admin)
router.get("/admin/stats", authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const total = await prisma.pushSubscription.count();
    const withUser = await prisma.pushSubscription.count({ where: { userId: { not: null } } });
    res.json({ total, registered: withUser, anonymous: total - withUser });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/push/admin/:id — Delete a subscriber (admin)
router.delete("/admin/:id", authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.pushSubscription.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
