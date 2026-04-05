import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export interface ApiKeyRequest extends Request {
  apiKey?: {
    id: string;
    name: string;
    permissions: string[];
    rateLimit: number;
  };
}

export async function authenticateApiKey(req: ApiKeyRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const queryKey = req.query.api_key as string;

  const key = authHeader?.startsWith("Bearer sk_")
    ? authHeader.slice(7)
    : queryKey;

  if (!key) {
    return res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "API key required. Pass via Authorization: Bearer sk_live_xxx or ?api_key=sk_live_xxx" }
    });
  }

  try {
    const apiKey = await prisma.apiKey.findUnique({ where: { key } });

    if (!apiKey) {
      return res.status(401).json({ error: { code: "INVALID_KEY", message: "Invalid API key" } });
    }

    if (!apiKey.isActive) {
      return res.status(403).json({ error: { code: "KEY_DISABLED", message: "This API key has been disabled" } });
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return res.status(403).json({ error: { code: "KEY_EXPIRED", message: "This API key has expired" } });
    }

    // IP whitelist check
    if (apiKey.ipWhitelist.length > 0) {
      const clientIp = req.ip || req.socket.remoteAddress || "";
      if (!apiKey.ipWhitelist.includes(clientIp)) {
        return res.status(403).json({ error: { code: "IP_BLOCKED", message: "Request from unauthorized IP" } });
      }
    }

    // Rate limiting
    const now = Date.now();
    const windowMs = 60_000;
    let entry = rateLimitMap.get(apiKey.id);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      rateLimitMap.set(apiKey.id, entry);
    }

    entry.count++;

    res.set("X-RateLimit-Limit", String(apiKey.rateLimit));
    res.set("X-RateLimit-Remaining", String(Math.max(0, apiKey.rateLimit - entry.count)));
    res.set("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > apiKey.rateLimit) {
      return res.status(429).json({
        error: { code: "RATE_LIMITED", message: `Rate limit exceeded. Max ${apiKey.rateLimit} requests/minute.` }
      });
    }

    // Update last used (fire-and-forget)
    prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date(), requestCount: { increment: 1 } }
    }).catch(() => {});

    req.apiKey = {
      id: apiKey.id,
      name: apiKey.name,
      permissions: apiKey.permissions,
      rateLimit: apiKey.rateLimit,
    };

    next();
  } catch (e: any) {
    res.status(500).json({ error: { code: "INTERNAL", message: "Authentication error" } });
  }
}

// Permission check middleware factory
export function requirePermission(...perms: string[]) {
  return (req: ApiKeyRequest, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    }

    const has = perms.every(p => {
      const [resource] = p.split(":");
      return req.apiKey!.permissions.includes(p) || req.apiKey!.permissions.includes(`${resource}:*`);
    });

    if (!has) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: `Missing permission: ${perms.join(", ")}` }
      });
    }

    next();
  };
}
