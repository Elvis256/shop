import { Router, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import prisma from "../lib/prisma";
import {
  generateToken,
  COOKIE_OPTIONS,
  REFRESH_COOKIE_OPTIONS,
  createRefreshToken,
} from "../middleware/auth";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

const GoogleAuthSchema = z.object({
  credential: z.string().min(1, "Google credential is required"),
});

// POST /api/auth/google
router.post("/google", asyncHandler(async (req, res: Response) => {
  try {
    const { credential } = GoogleAuthSchema.parse(req.body);

    // Verify the Google ID token via Google's tokeninfo endpoint
    const verifyRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );

    if (!verifyRes.ok) {
      return res.status(401).json({ error: "Invalid Google credential" });
    }

    const googleData = await verifyRes.json();

    const email = googleData.email as string;
    const name = (googleData.name as string) || (googleData.given_name as string) || undefined;
    const picture = (googleData.picture as string) || undefined;
    const googleId = googleData.sub as string;

    if (!email) {
      return res.status(400).json({ error: "Google account has no email" });
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true, googleId: true },
    });

    if (user) {
      // Link googleId if not already set
      if (!user.googleId) {
        await prisma.user.update({
          where: { id: user.id },
          data: { googleId },
        });
      }
    } else {
      // Create new user with random password (they'll use Google to login)
      const randomPassword = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);

      user = await prisma.user.create({
        data: {
          email,
          password: randomPassword,
          name,
          googleId,
          avatarUrl: picture,
          emailVerified: true,
        },
        select: { id: true, email: true, name: true, role: true, googleId: true },
      });
    }

    // Generate tokens
    const accessToken = generateToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = await createRefreshToken(user.id);

    // Set httpOnly cookies
    res.cookie("auth_token", accessToken, COOKIE_OPTIONS);
    res.cookie("refresh_token", refreshToken, REFRESH_COOKIE_OPTIONS);

    return res.json({
      message: "Google login successful",
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    logger.error("Google auth error", { error });
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    return res.status(500).json({ error: "Google authentication failed" });
  }
}));

export default router;
