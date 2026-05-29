import { Router, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma";
import redis from "../lib/redis";
import {
  generateToken,
  createRefreshToken,
  COOKIE_OPTIONS,
  REFRESH_COOKIE_OPTIONS,
} from "../middleware/auth";

const router = Router();

const SellerLoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Brute-force protection
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60; // 15 minutes

async function checkLockout(email: string): Promise<{ locked: boolean; remainingTime?: number }> {
  try {
    const key = `lockout:seller:${email}`;
    const data = await redis.get(key);
    if (!data) return { locked: false };
    const { count, lockedUntil } = JSON.parse(data);
    if (lockedUntil && Date.now() < lockedUntil) {
      return { locked: true, remainingTime: Math.ceil((lockedUntil - Date.now()) / 1000 / 60) };
    }
    return { locked: false };
  } catch {
    return { locked: false };
  }
}

async function recordFailedLogin(email: string): Promise<void> {
  try {
    const key = `lockout:seller:${email}`;
    const data = await redis.get(key);
    const attempts = data ? JSON.parse(data) : { count: 0, lockedUntil: null };
    attempts.count += 1;
    if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
      attempts.lockedUntil = Date.now() + LOCKOUT_DURATION * 1000;
    }
    await redis.set(key, JSON.stringify(attempts), "EX", LOCKOUT_DURATION * 2);
  } catch {
    // Redis down — skip
  }
}

async function clearLoginAttempts(email: string): Promise<void> {
  try {
    await redis.del(`lockout:seller:${email}`);
  } catch {
    // Redis down — ignore
  }
}

// POST /api/seller/auth/login
router.post("/login", async (req, res: Response) => {
  try {
    const body = SellerLoginSchema.parse(req.body);

    // Check brute-force lockout
    const lockout = await checkLockout(body.email);
    if (lockout.locked) {
      return res.status(429).json({
        error: `Account temporarily locked. Try again in ${lockout.remainingTime} minutes.`,
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true, email: true, name: true, password: true, role: true, isBlocked: true },
    });

    if (!user) {
      await recordFailedLogin(body.email);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Check if account is blocked
    if (user.isBlocked) {
      return res.status(403).json({ error: "Your account has been suspended. Contact support." });
    }

    const validPassword = await bcrypt.compare(body.password, user.password);
    if (!validPassword) {
      await recordFailedLogin(body.email);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Check seller record (not role — any user can also be a seller)
    const seller = await prisma.seller.findUnique({
      where: { userId: user.id },
      select: { status: true },
    });

    if (!seller) {
      return res.status(403).json({ error: "This account is not registered as a vendor" });
    }

    if (seller.status !== "APPROVED") {
      return res.status(403).json({
        error: seller.status === "PENDING"
          ? "Your vendor application is still under review"
          : "Your vendor account is not active"
      });
    }

    // Clear lockout on success
    await clearLoginAttempts(body.email);

    const accessToken = generateToken({ id: user.id, email: user.email, role: user.role, portal: "customer" });
    const refreshToken = await createRefreshToken(user.id);

    res.cookie("auth_token", accessToken, COOKIE_OPTIONS);
    res.cookie("refresh_token", refreshToken, REFRESH_COOKIE_OPTIONS);

    return res.json({
      message: "Vendor login successful",
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed" });
    }
    return res.status(500).json({ error: "Login failed" });
  }
});

export default router;
