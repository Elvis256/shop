import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, AuthRequest, requireAdmin } from "../../middleware/auth";
import crypto from "crypto";

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate, requireAdmin);

function generateApiKey(): string {
  return "sk_live_" + crypto.randomBytes(32).toString("hex");
}

// GET / — List all API keys
router.get("/", async (_req: AuthRequest, res: Response) => {
  try {
    const keys = await prisma.apiKey.findMany({
      select: {
        id: true, name: true, prefix: true, permissions: true,
        rateLimit: true, isActive: true, lastUsedAt: true,
        requestCount: true, ipWhitelist: true,
        createdAt: true, expiresAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(keys);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST / — Create API key
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const { name, permissions, rateLimit, ipWhitelist, expiresAt } = req.body;
    if (!name) return res.status(400).json({ error: "Name required" });

    const key = generateApiKey();
    const prefix = key.slice(0, 12) + "...";

    const apiKey = await prisma.apiKey.create({
      data: {
        name,
        key,
        prefix,
        permissions: permissions || ["products:read"],
        rateLimit: rateLimit || 100,
        userId: req.user!.id,
        ipWhitelist: ipWhitelist || [],
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    // Return full key ONCE (never shown again)
    res.json({
      ...apiKey,
      key,
      message: "Save this key — it won't be shown again."
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /:id — Update API key
router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { name, permissions, rateLimit, isActive, ipWhitelist, expiresAt } = req.body;
    const updated = await prisma.apiKey.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(permissions !== undefined && { permissions }),
        ...(rateLimit !== undefined && { rateLimit }),
        ...(isActive !== undefined && { isActive }),
        ...(ipWhitelist !== undefined && { ipWhitelist }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
      },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /:id — Revoke API key
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    await prisma.apiKey.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /:id/regenerate — Regenerate key
router.post("/:id/regenerate", async (req: AuthRequest, res: Response) => {
  try {
    const key = generateApiKey();
    const prefix = key.slice(0, 12) + "...";
    const updated = await prisma.apiKey.update({
      where: { id: req.params.id },
      data: { key, prefix },
    });
    res.json({ ...updated, key, message: "New key generated. Save it — it won't be shown again." });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
