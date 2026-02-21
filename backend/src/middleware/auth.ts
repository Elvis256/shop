import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";

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
  };
}

// Generate short-lived access token (15 min)
export function generateToken(payload: { id: string; email: string; role: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" } as jwt.SignOptions);
}

// Generate long-lived refresh token
export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString("hex");
}

export function verifyToken(token: string): { id: string; email: string; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: string };
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
  const accessToken = generateToken({
    id: tokenRecord.user.id,
    email: tokenRecord.user.email,
    role: tokenRecord.user.role,
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

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    // Try cookie first, then Authorization header (for backward compatibility/API clients)
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

    // Verify user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Authentication failed" });
  }
}

export async function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    // Try cookie first, then Authorization header
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
        req.user = decoded;
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
  next();
}

export async function requireRole(roles: string[]) {
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
