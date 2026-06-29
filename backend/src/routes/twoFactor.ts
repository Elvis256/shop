import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest, generateToken, createRefreshToken, COOKIE_OPTIONS, REFRESH_COOKIE_OPTIONS } from "../middleware/auth";
import redis from "../lib/redis";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

// Simple TOTP implementation
const generateSecret = () => {
  return crypto.randomBytes(20).toString("base64");
};

const generateTOTP = (secret: string, timeStep = 30): string => {
  const time = Math.floor(Date.now() / 1000 / timeStep);
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
  
  return code.toString().padStart(6, "0");
};

const verifyTOTP = (secret: string, token: string, window = 1): boolean => {
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
    
    if (code.toString().padStart(6, "0") === token) {
      return true;
    }
  }
  return false;
};

const generateBackupCodes = (): string[] => {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    codes.push(crypto.randomBytes(4).toString("hex").toUpperCase());
  }
  return codes;
};

// Get 2FA status
router.get("/status", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const twoFactor = await prisma.twoFactorAuth.findUnique({
      where: { userId },
    });

    res.json({
      enabled: twoFactor?.isEnabled || false,
      hasBackupCodes: (twoFactor?.backupCodes?.length ?? 0) > 0,
    });
  } catch (error) {
    logger.error("Get 2FA status error", { error });
    res.status(500).json({ error: "Failed to get 2FA status" });
  }
}));

// Setup 2FA (generate secret)
router.post("/setup", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    
    if (!userId || !userEmail) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const secret = generateSecret();
    const backupCodes = generateBackupCodes();
    
    // Hash backup codes for storage
    const hashedBackupCodes = backupCodes.map(code => 
      crypto.createHash("sha256").update(code).digest("hex")
    );

    // Upsert 2FA record
    await prisma.twoFactorAuth.upsert({
      where: { userId },
      update: {
        secret,
        backupCodes: hashedBackupCodes,
        isEnabled: false,
      },
      create: {
        userId,
        secret,
        backupCodes: hashedBackupCodes,
        isEnabled: false,
      },
    });

    // Generate QR code as data URL (server-side, no external API)
    const issuer = "PleasureZone";
    const hexSecret = Buffer.from(secret, "base64").toString("hex");
    const otpauthUrl = `otpauth://totp/${issuer}:${userEmail}?secret=${hexSecret}&issuer=${issuer}&digits=6&period=30`;
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, { width: 200, margin: 1 });

    res.json({
      secret: hexSecret,
      qrCodeUrl: qrCodeDataUrl,
      backupCodes, // Show only once
    });
  } catch (error) {
    logger.error("Setup 2FA error", { error });
    res.status(500).json({ error: "Failed to setup 2FA" });
  }
}));

// Enable 2FA (verify first code)
router.post("/enable", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { token } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!token || token.length !== 6) {
      return res.status(400).json({ error: "Invalid verification code" });
    }

    const twoFactor = await prisma.twoFactorAuth.findUnique({
      where: { userId },
    });

    if (!twoFactor) {
      return res.status(400).json({ error: "2FA not setup. Please run setup first." });
    }

    if (twoFactor.isEnabled) {
      return res.status(400).json({ error: "2FA is already enabled" });
    }

    // Verify the token
    if (!verifyTOTP(twoFactor.secret, token)) {
      return res.status(400).json({ error: "Invalid verification code" });
    }

    await prisma.twoFactorAuth.update({
      where: { userId },
      data: { isEnabled: true },
    });

    res.json({ message: "Two-factor authentication enabled successfully" });
  } catch (error) {
    logger.error("Enable 2FA error", { error });
    res.status(500).json({ error: "Failed to enable 2FA" });
  }
}));

// Verify 2FA token (during login) — issues JWT tokens on success
router.post("/verify", asyncHandler(async (req, res) => {
  try {
    const { twoFaToken, token } = req.body;

    if (!twoFaToken || !token) {
      return res.status(400).json({ error: "Verification token and code required" });
    }

    // Resolve userId from opaque 2FA token (stored in Redis during login)
    let userId: string | null = null;
    try {
      userId = await redis.get(`2fa:pending:${twoFaToken}`);
    } catch {}
    if (!userId) {
      return res.status(400).json({ error: "2FA session expired. Please login again." });
    }

    // Delete the pending token so it can't be reused
    try { await redis.del(`2fa:pending:${twoFaToken}`); } catch {}

    // Rate limit 2FA verification attempts (10 attempts per 15 minutes per userId)
    const rateLimitKey = `2fa_attempts:${userId}`;
    try {
      const attempts = await redis.incr(rateLimitKey);
      if (attempts === 1) {
        await redis.expire(rateLimitKey, 15 * 60); // 15 min window
      }
      if (attempts > 10) {
        return res.status(429).json({ error: "Too many verification attempts. Please try again later." });
      }
    } catch {
      // Redis down — continue without rate limiting
    }

    const twoFactor = await prisma.twoFactorAuth.findUnique({
      where: { userId },
    });

    if (!twoFactor || !twoFactor.isEnabled) {
      return res.status(400).json({ error: "2FA not enabled for this user" });
    }

    let verified = false;
    let usedBackupCode = false;

    // Try TOTP first
    if (verifyTOTP(twoFactor.secret, token)) {
      verified = true;
    } else {
      // Try backup code
      const hashedToken = crypto.createHash("sha256").update(token.toUpperCase()).digest("hex");
      const backupCodeIndex = twoFactor.backupCodes.indexOf(hashedToken);

      if (backupCodeIndex !== -1) {
        // Remove used backup code
        const updatedCodes = [...twoFactor.backupCodes];
        updatedCodes.splice(backupCodeIndex, 1);

        await prisma.twoFactorAuth.update({
          where: { userId },
          data: {
            backupCodes: updatedCodes,
            lastUsedAt: new Date(),
          },
        });
        verified = true;
        usedBackupCode = true;
      }
    }

    if (!verified) {
      return res.status(400).json({ valid: false, error: "Invalid verification code" });
    }

    await prisma.twoFactorAuth.update({
      where: { userId },
      data: { lastUsedAt: new Date() },
    });

    // Clear rate limit on success
    try { await redis.del(rateLimitKey); } catch {}

    // Issue JWT tokens to complete the login flow
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, isBlocked: true },
    });

    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ error: "Account has been suspended" });
    }

    const portal = (user.role === "ADMIN" || user.role === "MANAGER") ? "admin" : "customer";
    const accessToken = generateToken({ id: user.id, email: user.email, role: user.role, portal });
    const refreshToken = await createRefreshToken(user.id);

    res.cookie("auth_token", accessToken, COOKIE_OPTIONS);
    res.cookie("refresh_token", refreshToken, REFRESH_COOKIE_OPTIONS);

    return res.json({
      valid: true,
      usedBackupCode,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    logger.error("Verify 2FA error", { error });
    res.status(500).json({ error: "Failed to verify 2FA" });
  }
}));

// Disable 2FA
router.post("/disable", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { password, token } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Require password to disable 2FA
    if (!password) {
      return res.status(400).json({ error: "Password is required to disable 2FA" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: "Incorrect password" });
    }

    const twoFactor = await prisma.twoFactorAuth.findUnique({
      where: { userId },
    });

    if (!twoFactor || !twoFactor.isEnabled) {
      return res.status(400).json({ error: "2FA is not enabled" });
    }

    // Verify TOTP token before disabling
    if (!verifyTOTP(twoFactor.secret, token)) {
      return res.status(400).json({ error: "Invalid verification code" });
    }

    await prisma.twoFactorAuth.delete({
      where: { userId },
    });

    res.json({ message: "Two-factor authentication disabled" });
  } catch (error) {
    logger.error("Disable 2FA error", { error });
    res.status(500).json({ error: "Failed to disable 2FA" });
  }
}));

// Regenerate backup codes
router.post("/backup-codes", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { token } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const twoFactor = await prisma.twoFactorAuth.findUnique({
      where: { userId },
    });

    if (!twoFactor || !twoFactor.isEnabled) {
      return res.status(400).json({ error: "2FA is not enabled" });
    }

    // Verify current token
    if (!verifyTOTP(twoFactor.secret, token)) {
      return res.status(400).json({ error: "Invalid verification code" });
    }

    const newBackupCodes = generateBackupCodes();
    const hashedCodes = newBackupCodes.map(code =>
      crypto.createHash("sha256").update(code).digest("hex")
    );

    await prisma.twoFactorAuth.update({
      where: { userId },
      data: { backupCodes: hashedCodes },
    });

    res.json({ backupCodes: newBackupCodes });
  } catch (error) {
    logger.error("Regenerate backup codes error", { error });
    res.status(500).json({ error: "Failed to regenerate backup codes" });
  }
}));

export default router;
