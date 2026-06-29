import { Router, Response } from "express";
import prisma from "../../lib/prisma";
import { authenticate, AuthRequest, requireAdmin } from "../../middleware/auth";
import { hashApiKey } from "../../middleware/apiKeyAuth";
import crypto from "crypto";
import { asyncHandler } from "../../middleware/errorHandler";

const router = Router();

router.use(authenticate, requireAdmin);

const VALID_PERMISSIONS = [
  "products:read", "products:write",
  "orders:read", "orders:write",
  "customers:read", "customers:write",
  "inventory:read", "inventory:write",
  "webhooks:read", "webhooks:write",
];

function generateApiKey(): string {
  return "sk_live_" + crypto.randomBytes(32).toString("hex");
}

function validatePermissions(perms: string[]): string[] | null {
  if (!Array.isArray(perms) || perms.length === 0) return null;
  const invalid = perms.filter(p => !VALID_PERMISSIONS.includes(p));
  return invalid.length > 0 ? invalid : null;
}

// GET / — List all API keys (never returns key or hash)
router.get("/", asyncHandler(async (_req: AuthRequest, res: Response) => {
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
  } catch {
    res.status(500).json({ error: "Failed to list API keys" });
  }
}));

// POST / — Create API key
router.post("/", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { name, permissions, rateLimit, ipWhitelist, expiresAt } = req.body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "Name is required" });
    }

    const perms = permissions || ["products:read"];
    const invalidPerms = validatePermissions(perms);
    if (invalidPerms) {
      return res.status(400).json({ error: `Invalid permissions: ${invalidPerms.join(", ")}` });
    }

    const parsedRate = parseInt(rateLimit) || 100;
    if (parsedRate < 1 || parsedRate > 10000) {
      return res.status(400).json({ error: "Rate limit must be between 1 and 10,000 req/min" });
    }

    if (expiresAt) {
      const d = new Date(expiresAt);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ error: "Invalid expiresAt date format" });
      }
      if (d <= new Date()) {
        return res.status(400).json({ error: "expiresAt must be in the future" });
      }
    }

    const key = generateApiKey();
    const keyHash = hashApiKey(key);
    const prefix = key.slice(0, 12) + "...";

    const apiKey = await prisma.apiKey.create({
      data: {
        name: name.trim(),
        keyHash,
        prefix,
        permissions: perms,
        rateLimit: parsedRate,
        userId: req.user!.id,
        ipWhitelist: Array.isArray(ipWhitelist) ? ipWhitelist : [],
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    // Return full key ONCE (never shown again — only hash is stored)
    res.json({
      id: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.prefix,
      permissions: apiKey.permissions,
      rateLimit: apiKey.rateLimit,
      ipWhitelist: apiKey.ipWhitelist,
      createdAt: apiKey.createdAt,
      expiresAt: apiKey.expiresAt,
      key, // Plaintext key — shown only this once
      message: "Save this key — it won't be shown again."
    });
  } catch {
    res.status(500).json({ error: "Failed to create API key" });
  }
}));

// PUT /:id — Update API key metadata (never changes the key itself)
router.put("/:id", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { name, permissions, rateLimit, isActive, ipWhitelist, expiresAt } = req.body;

    if (permissions) {
      const invalidPerms = validatePermissions(permissions);
      if (invalidPerms) {
        return res.status(400).json({ error: `Invalid permissions: ${invalidPerms.join(", ")}` });
      }
    }

    if (rateLimit !== undefined) {
      const parsedRate = parseInt(rateLimit);
      if (isNaN(parsedRate) || parsedRate < 1 || parsedRate > 10000) {
        return res.status(400).json({ error: "Rate limit must be between 1 and 10,000 req/min" });
      }
    }

    const updated = await prisma.apiKey.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(permissions !== undefined && { permissions }),
        ...(rateLimit !== undefined && { rateLimit: parseInt(rateLimit) }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        ...(ipWhitelist !== undefined && { ipWhitelist: Array.isArray(ipWhitelist) ? ipWhitelist : [] }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
      },
      select: {
        id: true, name: true, prefix: true, permissions: true,
        rateLimit: true, isActive: true, ipWhitelist: true,
        createdAt: true, expiresAt: true,
      },
    });
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Failed to update API key" });
  }
}));

// DELETE /:id — Revoke API key
router.delete("/:id", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    await prisma.apiKey.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete API key" });
  }
}));

// POST /:id/regenerate — Regenerate key (new hash, new prefix)
router.post("/:id/regenerate", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const key = generateApiKey();
    const keyHash = hashApiKey(key);
    const prefix = key.slice(0, 12) + "...";

    const updated = await prisma.apiKey.update({
      where: { id: req.params.id },
      data: { keyHash, prefix },
      select: {
        id: true, name: true, prefix: true, permissions: true,
        rateLimit: true, isActive: true, createdAt: true,
      },
    });
    res.json({ ...updated, key, message: "New key generated. Save it — it won't be shown again." });
  } catch {
    res.status(500).json({ error: "Failed to regenerate API key" });
  }
}));

export default router;
