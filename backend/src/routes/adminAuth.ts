import { Router, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import prisma from "../lib/prisma";
import redis from "../lib/redis";
import {
  generateToken,
  createRefreshToken,
  COOKIE_OPTIONS,
  REFRESH_COOKIE_OPTIONS,
} from "../middleware/auth";

const router = Router();

const AdminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  totpCode: z.string().optional(),
});

const MAX_ATTEMPTS = 3;
const LOCKOUT_SECONDS = 30 * 60; // 30 minutes

// Custom TOTP verification (matches twoFactor.ts implementation)
function verifyTOTP(secret: string, token: string, window = 1): boolean {
  const timeStep = 30;
  for (let i = -window; i <= window; i++) {
    const time = Math.floor(Date.now() / 1000 / timeStep) + i;
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(time));
    const hmac = crypto.createHmac("sha1", Buffer.from(secret, "base64"));
    hmac.update(buffer);
    const hash = hmac.digest();
    const offset = hash[hash.length - 1] & 0x0f;
    const code = (
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff)
    ) % 1000000;
    if (code.toString().padStart(6, "0") === token) return true;
  }
  return false;
}

async function checkAdminLockout(email: string): Promise<{ locked: boolean; remainingTime?: number }> {
  try {
    const data = await redis.get(`admin_lockout:${email}`);
    if (!data) return { locked: false };
    const { lockedUntil } = JSON.parse(data);
    if (lockedUntil && Date.now() < lockedUntil) {
      return { locked: true, remainingTime: Math.ceil((lockedUntil - Date.now()) / 1000 / 60) };
    }
    return { locked: false };
  } catch {
    return { locked: false };
  }
}

async function recordAdminFailedLogin(email: string, ip: string): Promise<void> {
  try {
    const key = `admin_lockout:${email}`;
    const data = await redis.get(key);
    const attempts = data ? JSON.parse(data) : { count: 0, lockedUntil: null };
    attempts.count += 1;
    if (attempts.count >= MAX_ATTEMPTS) {
      attempts.lockedUntil = Date.now() + LOCKOUT_SECONDS * 1000;
    }
    await redis.set(key, JSON.stringify(attempts), "EX", LOCKOUT_SECONDS * 2);

    // Log suspicious activity
    console.warn(`[ADMIN LOGIN] Failed attempt for ${email} from ${ip} (attempt #${attempts.count})`);
  } catch {
    // Redis down — skip
  }
}

async function clearAdminLockout(email: string): Promise<void> {
  try {
    await redis.del(`admin_lockout:${email}`);
  } catch {}
}

// POST /api/admin/auth/login
router.post("/login", async (req, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";

  try {
    const body = AdminLoginSchema.parse(req.body);

    // Stricter lockout for admin panel
    const lockout = await checkAdminLockout(body.email);
    if (lockout.locked) {
      return res.status(429).json({
        error: `Admin account locked. Try again in ${lockout.remainingTime} minutes.`,
      });
    }

    // Find user — must be ADMIN or MANAGER
    const user = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true, email: true, name: true, password: true, role: true },
    });

    if (!user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
      await recordAdminFailedLogin(body.email, ip);
      return res.status(401).json({ error: "Invalid credentials or insufficient permissions" });
    }

    const validPassword = await bcrypt.compare(body.password, user.password);
    if (!validPassword) {
      await recordAdminFailedLogin(body.email, ip);
      return res.status(401).json({ error: "Invalid credentials or insufficient permissions" });
    }

    // Check 2FA (gracefully skip if table doesn't exist yet)
    let twoFactor = null;
    try {
      twoFactor = await prisma.twoFactorAuth.findUnique({
        where: { userId: user.id },
        select: { isEnabled: true, secret: true, backupCodes: true },
      });
    } catch {
      // Table may not exist in older DB — skip 2FA check
    }

    if (twoFactor?.isEnabled) {
      if (!body.totpCode) {
        // Password correct but no TOTP — tell frontend to ask for it
        return res.status(202).json({
          message: "2FA required",
          requires2FA: true,
          userId: user.id,
        });
      }

      // Verify TOTP using same implementation as twoFactor.ts
      const isValidTotp = verifyTOTP(twoFactor.secret, body.totpCode);

      // Check backup codes if TOTP fails
      const codeHash = crypto.createHash("sha256").update(body.totpCode).digest("hex");
      const isBackupCode = twoFactor.backupCodes.includes(codeHash);

      if (!isValidTotp && !isBackupCode) {
        await recordAdminFailedLogin(body.email, ip);
        return res.status(401).json({ error: "Invalid 2FA code" });
      }

      // Consume backup code if used
      if (isBackupCode) {
        await prisma.twoFactorAuth.update({
          where: { userId: user.id },
          data: { backupCodes: { set: twoFactor.backupCodes.filter((c) => c !== codeHash) } },
        });
      }
    }

    await clearAdminLockout(body.email);

    // Log successful admin login
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "ADMIN_LOGIN",
        entityType: "User",
        entityId: user.id,
        description: `Admin login from ${ip}`,
        metadata: { ip, userAgent: req.headers["user-agent"] },
        ipAddress: ip,
      },
    }).catch(() => {});

    const accessToken = generateToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = await createRefreshToken(user.id);

    res.cookie("auth_token", accessToken, COOKIE_OPTIONS);
    res.cookie("refresh_token", refreshToken, REFRESH_COOKIE_OPTIONS);

    return res.json({
      message: "Admin login successful",
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    return res.status(500).json({ error: "Login failed" });
  }
});

export default router;
