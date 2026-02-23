import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";

const router = Router();

// POST /api/analytics/track - record a page view
router.post("/track", async (req: Request, res: Response) => {
  try {
    const { path, referrer, sessionId } = req.body;
    if (!path) return res.status(400).json({ error: "path required" });

    await prisma.pageView.create({
      data: {
        path: String(path).slice(0, 500),
        referrer: referrer ? String(referrer).slice(0, 500) : null,
        userAgent: req.headers["user-agent"]?.slice(0, 500) || null,
        sessionId: sessionId ? String(sessionId).slice(0, 64) : null,
      },
    });

    return res.status(204).send();
  } catch {
    return res.status(204).send(); // silently fail — never break the page
  }
});

export default router;
