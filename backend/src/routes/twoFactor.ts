import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, AuthRequest } from "../middleware/auth";
import crypto from "crypto";

const router = Router();
const prisma = new PrismaClient();

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
router.get("/status", authenticate, async (req: AuthRequest, res: Response) => {
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
    console.error("Get 2FA status error:", error);
    res.status(500).json({ error: "Failed to get 2FA status" });
  }
});

// Setup 2FA (generate secret)
router.post("/setup", authenticate, async (req: AuthRequest, res: Response) => {
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

    // Generate QR code URL (otpauth format)
    const issuer = "PleasureZone";
    const otpauthUrl = `otpauth://totp/${issuer}:${userEmail}?secret=${Buffer.from(secret, "base64").toString("hex")}&issuer=${issuer}&digits=6&period=30`;

    res.json({
      secret: Buffer.from(secret, "base64").toString("hex"),
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`,
      backupCodes, // Show only once
    });
  } catch (error) {
    console.error("Setup 2FA error:", error);
    res.status(500).json({ error: "Failed to setup 2FA" });
  }
});

// Enable 2FA (verify first code)
router.post("/enable", authenticate, async (req: AuthRequest, res: Response) => {
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
    console.error("Enable 2FA error:", error);
    res.status(500).json({ error: "Failed to enable 2FA" });
  }
});

// Verify 2FA token (during login)
router.post("/verify", async (req, res) => {
  try {
    const { userId, token } = req.body;

    if (!userId || !token) {
      return res.status(400).json({ error: "User ID and token required" });
    }

    const twoFactor = await prisma.twoFactorAuth.findUnique({
      where: { userId },
    });

    if (!twoFactor || !twoFactor.isEnabled) {
      return res.status(400).json({ error: "2FA not enabled for this user" });
    }

    // Try TOTP first
    if (verifyTOTP(twoFactor.secret, token)) {
      await prisma.twoFactorAuth.update({
        where: { userId },
        data: { lastUsedAt: new Date() },
      });
      return res.json({ valid: true });
    }

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
      
      return res.json({ valid: true, usedBackupCode: true });
    }

    res.status(400).json({ valid: false, error: "Invalid verification code" });
  } catch (error) {
    console.error("Verify 2FA error:", error);
    res.status(500).json({ error: "Failed to verify 2FA" });
  }
});

// Disable 2FA
router.post("/disable", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { password, token } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const twoFactor = await prisma.twoFactorAuth.findUnique({
      where: { userId },
    });

    if (!twoFactor || !twoFactor.isEnabled) {
      return res.status(400).json({ error: "2FA is not enabled" });
    }

    // Verify token before disabling
    if (!verifyTOTP(twoFactor.secret, token)) {
      return res.status(400).json({ error: "Invalid verification code" });
    }

    await prisma.twoFactorAuth.delete({
      where: { userId },
    });

    res.json({ message: "Two-factor authentication disabled" });
  } catch (error) {
    console.error("Disable 2FA error:", error);
    res.status(500).json({ error: "Failed to disable 2FA" });
  }
});

// Regenerate backup codes
router.post("/backup-codes", authenticate, async (req: AuthRequest, res: Response) => {
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
    console.error("Regenerate backup codes error:", error);
    res.status(500).json({ error: "Failed to regenerate backup codes" });
  }
});

export default router;
