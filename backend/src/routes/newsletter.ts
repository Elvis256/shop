import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { sendNewsletterWelcome } from "../services/email";

const router = Router();

// POST /api/newsletter/subscribe
router.post("/subscribe", async (req: Request, res: Response) => {
  try {
    const { email, name, source } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Valid email is required" });
    }

    // Check if already subscribed
    const existing = await prisma.newsletter.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      if (existing.isSubscribed) {
        return res.json({ message: "You're already subscribed!" });
      }
      // Resubscribe
      await prisma.newsletter.update({
        where: { email: email.toLowerCase() },
        data: { isSubscribed: true, updatedAt: new Date() },
      });
      return res.json({ message: "Welcome back! You've been resubscribed." });
    }

    // Create new subscription
    await prisma.newsletter.create({
      data: {
        email: email.toLowerCase(),
        name,
        source: source || "website",
      },
    });

    // Send welcome email (async, don't wait)
    sendNewsletterWelcome(email.toLowerCase()).catch(console.error);

    return res.status(201).json({
      message: "Successfully subscribed! Check your email for a welcome gift.",
    });
  } catch (error) {
    console.error("Newsletter subscribe error:", error);
    return res.status(500).json({ error: "Failed to subscribe" });
  }
});

// POST /api/newsletter/unsubscribe
router.post("/unsubscribe", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const subscriber = await prisma.newsletter.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!subscriber) {
      return res.json({ message: "Email not found in our list" });
    }

    await prisma.newsletter.update({
      where: { email: email.toLowerCase() },
      data: { isSubscribed: false },
    });

    return res.json({ message: "Successfully unsubscribed" });
  } catch (error) {
    console.error("Newsletter unsubscribe error:", error);
    return res.status(500).json({ error: "Failed to unsubscribe" });
  }
});

// GET /api/newsletter/status
router.get("/status", async (req: Request, res: Response) => {
  try {
    const { email } = req.query;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }

    const subscriber = await prisma.newsletter.findUnique({
      where: { email: email.toLowerCase() },
    });

    return res.json({
      subscribed: subscriber?.isSubscribed || false,
    });
  } catch (error) {
    console.error("Newsletter status error:", error);
    return res.status(500).json({ error: "Failed to check status" });
  }
});

// GET /api/newsletter/admin/subscribers - Admin list of subscribers
router.get("/admin/subscribers", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const [subscribers, total] = await Promise.all([
      prisma.newsletter.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.newsletter.count(),
    ]);

    return res.json({ subscribers, total, page, limit });
  } catch (error) {
    console.error("Newsletter admin list error:", error);
    return res.status(500).json({ error: "Failed to fetch subscribers" });
  }
});

export default router;
