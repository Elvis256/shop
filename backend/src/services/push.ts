import webpush from "web-push";
import prisma from "../lib/prisma";
import { logger } from "../lib/logger";

// Re-use the VAPID keys from pushNotifications route to avoid key mismatch
import { vapidPublicKey } from "../routes/pushNotifications";

// The webpush details are already set by pushNotifications.ts on module load.
// We only call setVapidDetails here as a safety fallback if this module loads first.
const pub = process.env.VAPID_PUBLIC_KEY || vapidPublicKey;
const priv = process.env.VAPID_PRIVATE_KEY || "";
if (pub && priv) {
  webpush.setVapidDetails(
    `mailto:${process.env.FROM_EMAIL || "admin@example.com"}`,
    pub,
    priv
  );
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<boolean> {
  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) return false;

    const data = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || "/",
    });

    let sent = false;
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          data
        );
        sent = true;
      } catch (err: any) {
        // Remove invalid subscriptions (410 Gone or 404)
        if (err.statusCode === 410 || err.statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    }

    return sent;
  } catch (e: any) {
    logger.error("Push notification error", { error: e.message, userId });
    return false;
  }
}
