import { Router, Response } from "express";
import crypto from "crypto";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest, requireAdmin } from "../middleware/auth";

const router = Router();
router.use(authenticate, requireAdmin);

// GET /api/webhooks/endpoints — List all webhook endpoints
router.get("/", async (_req: AuthRequest, res: Response) => {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      orderBy: { createdAt: "desc" },
    });
    return res.json({ endpoints });
  } catch (error) {
    console.error("List webhook endpoints error:", error);
    return res.status(500).json({ error: "Failed to fetch webhook endpoints" });
  }
});

// POST /api/webhooks/endpoints — Create endpoint
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const { url, events } = req.body;

    if (!url || !events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: "url and events[] are required" });
    }

    const secret = crypto.randomBytes(32).toString("hex");

    const endpoint = await prisma.webhookEndpoint.create({
      data: { url, events, secret, isActive: true },
    });

    return res.status(201).json({ endpoint });
  } catch (error) {
    console.error("Create webhook endpoint error:", error);
    return res.status(500).json({ error: "Failed to create webhook endpoint" });
  }
});

// PUT /api/webhooks/endpoints/:id — Update endpoint
router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { url, events, isActive } = req.body;

    const existing = await prisma.webhookEndpoint.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Webhook endpoint not found" });
    }

    const data: any = {};
    if (url) data.url = url;
    if (events && Array.isArray(events)) data.events = events;
    if (typeof isActive === "boolean") data.isActive = isActive;

    const updated = await prisma.webhookEndpoint.update({ where: { id }, data });
    return res.json({ endpoint: updated });
  } catch (error) {
    console.error("Update webhook endpoint error:", error);
    return res.status(500).json({ error: "Failed to update webhook endpoint" });
  }
});

// DELETE /api/webhooks/endpoints/:id — Delete endpoint
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.webhookEndpoint.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Webhook endpoint not found" });
    }

    await prisma.webhookEndpoint.delete({ where: { id } });
    return res.json({ message: "Webhook endpoint deleted" });
  } catch (error) {
    console.error("Delete webhook endpoint error:", error);
    return res.status(500).json({ error: "Failed to delete webhook endpoint" });
  }
});

// POST /api/webhooks/endpoints/:id/test — Send test webhook
router.post("/:id/test", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const endpoint = await prisma.webhookEndpoint.findUnique({ where: { id } });
    if (!endpoint) {
      return res.status(404).json({ error: "Webhook endpoint not found" });
    }

    const testPayload = {
      event: "test",
      data: { message: "This is a test webhook", timestamp: new Date().toISOString() },
    };

    const body = JSON.stringify(testPayload);
    const signature = crypto.createHmac("sha256", endpoint.secret).update(body).digest("hex");

    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    return res.json({
      message: "Test webhook sent",
      status: response.status,
      success: response.ok,
    });
  } catch (error: any) {
    console.error("Test webhook error:", error);
    return res.status(500).json({ error: "Failed to send test webhook", detail: error.message });
  }
});

/**
 * Dispatch a webhook event to all active endpoints subscribed to this event.
 * Signs the payload with HMAC-SHA256 using the endpoint's secret.
 */
export async function dispatchWebhook(event: string, payload: any): Promise<void> {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { isActive: true, events: { has: event } },
    });

    for (const endpoint of endpoints) {
      const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
      const signature = crypto.createHmac("sha256", endpoint.secret).update(body).digest("hex");

      try {
        const response = await fetch(endpoint.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Signature": signature,
          },
          body,
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          await prisma.webhookEndpoint.update({
            where: { id: endpoint.id },
            data: { failCount: { increment: 1 }, lastError: `HTTP ${response.status}` },
          });
        } else {
          // Reset fail count on success
          if (endpoint.failCount > 0) {
            await prisma.webhookEndpoint.update({
              where: { id: endpoint.id },
              data: { failCount: 0, lastError: null },
            });
          }
        }
      } catch (err: any) {
        await prisma.webhookEndpoint.update({
          where: { id: endpoint.id },
          data: { failCount: { increment: 1 }, lastError: err.message },
        });
      }
    }
  } catch (error) {
    console.error("Dispatch webhook error:", error);
  }
}

export default router;
