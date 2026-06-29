import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import redis from "../lib/redis";

// SECURITY: Require JWT_SECRET in production - no fallback allowed
const envSecret = process.env.JWT_SECRET;
if (!envSecret) {
  throw new Error("FATAL: JWT_SECRET environment variable is required");
}
const JWT_SECRET: string = envSecret;

// Cookie configuration
const isProduction = process.env.NODE_ENV === "production";
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "strict" as const : "lax" as const,
  maxAge: 15 * 60 * 1000, // 15 minutes for access token
  path: "/",
};

export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "strict" as const : "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days for refresh token
  path: "/api/auth", // Only sent to auth endpoints
};

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    portal?: string;
  };
}

// Generate short-lived access token (15 min)
export function generateToken(payload: { id: string; email: string; role: string; portal?: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" } as jwt.SignOptions);
}

// Generate long-lived refresh token
export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString("hex");
}

export function verifyToken(token: string): { id: string; email: string; role: string; portal?: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: string; portal?: string };
  } catch {
    return null;
  }
}

// Store refresh token in database
export async function createRefreshToken(userId: string): Promise<string> {
  const token = generateRefreshToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  await prisma.refreshToken.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });
  
  return token;
}

// Validate and rotate refresh token
export async function rotateRefreshToken(oldToken: string): Promise<{ accessToken: string; refreshToken: string; user: { id: string; email: string; role: string } } | null> {
  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { token: oldToken },
    include: { user: { select: { id: true, email: true, role: true } } },
  });
  
  if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
    // Delete expired/invalid token
    if (tokenRecord) {
      await prisma.refreshToken.delete({ where: { id: tokenRecord.id } });
    }
    return null;
  }
  
  // Rotate: delete old token, create new one
  await prisma.refreshToken.delete({ where: { id: tokenRecord.id } });
  
  const newRefreshToken = await createRefreshToken(tokenRecord.userId);
  // Preserve portal context — sellers use "customer" portal (seller access via DB record)
  const portal = (tokenRecord.user.role === "ADMIN" || tokenRecord.user.role === "MANAGER") ? "admin" : "customer";
  const accessToken = generateToken({
    id: tokenRecord.user.id,
    email: tokenRecord.user.email,
    role: tokenRecord.user.role,
    portal,
  });
  
  return {
    accessToken,
    refreshToken: newRefreshToken,
    user: tokenRecord.user,
  };
}

// Invalidate all refresh tokens for a user (logout all devices)
export async function invalidateAllRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { userId } });
}

// Cache user auth data in Redis (5 min TTL) to avoid DB hit on every request
// Safe because invalidateAuthCache() is called on user block/update
const AUTH_CACHE_TTL = 300;

async function getCachedUser(userId: string): Promise<{ id: string; email: string; role: string; isBlocked: boolean } | null> {
  try {
    const cached = await redis.get(`auth:user:${userId}`);
    if (cached) return JSON.parse(cached);
  } catch {}

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, isBlocked: true },
  });

  if (user) {
    try { await redis.set(`auth:user:${userId}`, JSON.stringify(user), "EX", AUTH_CACHE_TTL); } catch {}
  }

  return user;
}

// Call this when a user is blocked/updated to invalidate their auth cache
export async function invalidateAuthCache(userId: string): Promise<void> {
  try { await redis.del(`auth:user:${userId}`); } catch {}
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    let token = req.cookies?.auth_token;

    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      }
    }

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const user = await getCachedUser(decoded.id);

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ error: "Account has been suspended" });
    }

    req.user = { ...user, portal: decoded.portal };
    next();
  } catch (error) {
    return res.status(401).json({ error: "Authentication failed" });
  }
}

export async function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    let token = req.cookies?.auth_token;

    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      }
    }

    if (token) {
      const decoded = verifyToken(token);
      if (decoded) {
        const user = await getCachedUser(decoded.id);
        if (user && !user.isBlocked) {
          req.user = decoded;
        }
      }
    }
    next();
  } catch {
    next();
  }
}

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (req.user.role !== "ADMIN" && req.user.role !== "MANAGER") {
    return res.status(403).json({ error: "Admin access required" });
  }
  if (req.user.portal && req.user.portal !== "admin") {
    return res.status(403).json({ error: "Admin portal access required. Please login at the admin portal." });
  }
  next();
}

export async function requireSeller(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  // Cache seller status (60s TTL)
  let sellerStatus: string | null = null;
  try {
    const cached = await redis.get(`auth:seller:${req.user.id}`);
    if (cached) { sellerStatus = cached; }
  } catch {}

  if (sellerStatus === null) {
    const seller = await prisma.seller.findUnique({
      where: { userId: req.user.id },
      select: { status: true },
    });
    sellerStatus = seller?.status || "NONE";
    try { await redis.set(`auth:seller:${req.user.id}`, sellerStatus, "EX", 60); } catch {}
  }

  if (sellerStatus !== "APPROVED") {
    return res.status(403).json({
      error: sellerStatus === "PENDING"
        ? "Your seller application is still under review"
        : "Seller access required",
    });
  }
  next();
}

export function requirePermission(...permissions: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    
    // ADMIN always has all permissions
    if (req.user.role === "ADMIN") return next();
    
    // Check if user's role has the required permissions
    const rolePermissions = await prisma.rolePermission.findMany({
      where: {
        role: req.user.role as any,
        permission: { name: { in: permissions } },
        granted: true,
      },
      include: { permission: true },
    });
    
    const grantedPerms = rolePermissions.map(rp => rp.permission.name);
    const hasAll = permissions.every(p => grantedPerms.includes(p));
    
    if (!hasAll) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

export function requireRole(roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}
