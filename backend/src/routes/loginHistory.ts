import { Router, Response } from "express";
import prisma from "../lib/prisma";
import logger from "../lib/logger";
import { authenticate, AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

// GET /api/auth/login-history — paginated login history (last 50)
router.get("/login-history", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      prisma.loginHistory.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
        select: { id: true, ipAddress: true, device: true, success: true, createdAt: true },
      }),
      prisma.loginHistory.count({ where: { userId } }),
    ]);

    return res.json({ records, total, page, limit });
  } catch (error) {
    logger.error("Login history error", { error });
    return res.status(500).json({ error: "Failed to fetch login history" });
  }
}));

// GET /api/auth/sessions — active refresh tokens with device/IP
router.get("/sessions", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const currentToken = req.cookies?.refresh_token;

    const sessions = await prisma.refreshToken.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, ipAddress: true, userAgent: true, device: true, createdAt: true, token: true },
    });

    return res.json(
      sessions.map((s) => ({
        id: s.id,
        ipAddress: s.ipAddress || "Unknown",
        device: s.device || "Unknown",
        createdAt: s.createdAt,
        isCurrent: s.token === currentToken,
      }))
    );
  } catch (error) {
    logger.error("Sessions error", { error });
    return res.status(500).json({ error: "Failed to fetch sessions" });
  }
}));

// DELETE /api/auth/sessions/:id — revoke a specific session
router.delete("/sessions/:id", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const token = await prisma.refreshToken.findFirst({ where: { id, userId } });
    if (!token) {
      return res.status(404).json({ error: "Session not found" });
    }

    await prisma.refreshToken.delete({ where: { id } });

    return res.json({ message: "Session terminated" });
  } catch (error) {
    logger.error("Delete session error", { error });
    return res.status(500).json({ error: "Failed to terminate session" });
  }
}));

export default router;
