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
  console.log("⚠️  VAPID keys generated. Set these in your .env:");
  console.log(`VAPID_PUBLIC_KEY=${vapidPublicKey}`);
  console.log(`VAPID_PRIVATE_KEY=${vapidPrivateKey}`);
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

    const subscriptions = await prisma.pushSubscription.findMany();
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

export default router;
