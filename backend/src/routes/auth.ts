import { Router, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import prisma from "../lib/prisma";
import redis from "../lib/redis";
import { 
  generateToken, 
  authenticate, 
  AuthRequest, 
  COOKIE_OPTIONS, 
  REFRESH_COOKIE_OPTIONS,
  createRefreshToken,
  rotateRefreshToken,
  invalidateAllRefreshTokens
} from "../middleware/auth";
import { sendWelcomeEmail, sendPasswordResetEmail } from "../lib/email";
import { sendVerificationEmail, sendWelcomeEmail as sendVerifiedWelcome } from "../services/email";

const router = Router();

// Strong password validation regex
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=\[\]{}|;:,.<>])[A-Za-z\d@$!%*?&#^()_+\-=\[\]{}|;:,.<>]{8,}$/;

// Validation schemas
const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(strongPasswordRegex, "Password must contain uppercase, lowercase, number, and special character"),
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

const ResetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8),
});

const UpdateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});

// POST /api/auth/register
router.post("/register", async (req, res: Response) => {
  try {
    const body = RegisterSchema.parse(req.body);

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(body.password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: body.email,
        password: hashedPassword,
        name: body.name,
        phone: body.phone,
      },
      select: { id: true, email: true, name: true, role: true },
    });

    // Generate tokens
    const accessToken = generateToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = await createRefreshToken(user.id);

    // Set httpOnly cookies
    res.cookie("auth_token", accessToken, COOKIE_OPTIONS);
    res.cookie("refresh_token", refreshToken, REFRESH_COOKIE_OPTIONS);

    // Create email verification token
    const verificationToken = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.emailVerification.create({
      data: {
        userId: user.id,
        token: verificationToken,
        expiresAt,
      },
    });

    // Send verification email (async, don't wait)
    sendVerificationEmail(user.email, verificationToken, user.name || undefined).catch(console.error);

    // Also send legacy welcome email
    sendWelcomeEmail({ email: user.email, name: user.name || undefined });

    return res.status(201).json({
      message: "Registration successful. Please check your email to verify your account.",
      user,
    });
  } catch (error) {
    console.error("Register error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    return res.status(500).json({ error: "Registration failed" });
  }
});

// Redis-backed login attempt tracking (falls back gracefully if Redis unavailable)
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60; // 15 minutes in seconds

async function checkAccountLockout(email: string): Promise<{ locked: boolean; remainingTime?: number }> {
  try {
    const key = `lockout:${email}`;
    const data = await redis.get(key);
    if (!data) return { locked: false };
    const { count, lockedUntil } = JSON.parse(data);
    if (lockedUntil && Date.now() < lockedUntil) {
      return { locked: true, remainingTime: Math.ceil((lockedUntil - Date.now()) / 1000 / 60) };
    }
    return { locked: false };
  } catch {
    return { locked: false }; // Redis down — allow login
  }
}

async function recordFailedLogin(email: string): Promise<void> {
  try {
    const key = `lockout:${email}`;
    const data = await redis.get(key);
    const attempts = data ? JSON.parse(data) : { count: 0, lockedUntil: null };
    attempts.count += 1;
    if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
      attempts.lockedUntil = Date.now() + LOCKOUT_DURATION * 1000;
    }
    await redis.set(key, JSON.stringify(attempts), "EX", LOCKOUT_DURATION * 2);
  } catch {
    // Redis down — skip tracking
  }
}

async function clearLoginAttempts(email: string): Promise<void> {
  try {
    await redis.del(`lockout:${email}`);
  } catch {
    // Redis down — ignore
  }
}

// POST /api/auth/login
router.post("/login", async (req, res: Response) => {
  try {
    const body = LoginSchema.parse(req.body);

    // Check for account lockout (Redis-backed)
    const lockoutStatus = await checkAccountLockout(body.email);
    if (lockoutStatus.locked) {
      return res.status(429).json({ 
        error: `Account temporarily locked. Try again in ${lockoutStatus.remainingTime} minutes.` 
      });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true, email: true, name: true, password: true, role: true },
    });

    if (!user) {
      await recordFailedLogin(body.email);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Verify password
    const validPassword = await bcrypt.compare(body.password, user.password);
    if (!validPassword) {
      await recordFailedLogin(body.email);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Clear failed attempts on successful login
    await clearLoginAttempts(body.email);

    // For admin/manager: check if 2FA is enabled — require TOTP code if so
    if (user.role === "ADMIN" || user.role === "MANAGER") {
      try {
        const twoFactor = await prisma.twoFactorAuth.findUnique({
          where: { userId: user.id },
          select: { isEnabled: true },
        });
        if (twoFactor?.isEnabled) {
          return res.status(202).json({
            message: "2FA required",
            requires2FA: true,
            userId: user.id,
          });
        }
      } catch {
        // Table may not exist yet — skip 2FA check
      }
    }

    // Generate tokens
    const accessToken = generateToken({ id: user.id, email: user.email, role: user.role });
    const refreshToken = await createRefreshToken(user.id);

    // Set httpOnly cookies
    res.cookie("auth_token", accessToken, COOKIE_OPTIONS);
    res.cookie("refresh_token", refreshToken, REFRESH_COOKIE_OPTIONS);

    return res.json({
      message: "Login successful",
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error("Login error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    return res.status(500).json({ error: "Login failed" });
  }
});

// POST /api/auth/forgot-password
router.post("/forgot-password", async (req, res: Response) => {
  try {
    const body = ForgotPasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    
    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ message: "If the email exists, a reset link has been sent" });
    }

    // Generate reset token
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save or update reset token
    await prisma.passwordReset.upsert({
      where: { userId: user.id },
      update: { token, expiresAt },
      create: { userId: user.id, token, expiresAt },
    });

    // Send email
    await sendPasswordResetEmail({ email: user.email, name: user.name || undefined }, token);

    return res.json({ message: "If the email exists, a reset link has been sent" });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ error: "Request failed" });
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req, res: Response) => {
  try {
    const body = ResetPasswordSchema.parse(req.body);

    // Find reset token
    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token: body.token },
      include: { user: true },
    });

    if (!resetRecord || resetRecord.expiresAt < new Date()) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(body.password, 12);

    // Update password and delete reset token
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRecord.userId },
        data: { password: hashedPassword },
      }),
      prisma.passwordReset.delete({ where: { id: resetRecord.id } }),
    ]);

    return res.json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ error: "Reset failed" });
  }
});

// GET /api/auth/me
router.get("/me", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        _count: { select: { orders: true, wishlist: true } },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(user);
  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// PUT /api/auth/me
router.put("/me", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const body = UpdateProfileSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: body,
      select: { id: true, email: true, name: true, phone: true, role: true },
    });

    return res.json({ message: "Profile updated", user });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({ error: "Update failed" });
  }
});

// POST /api/auth/change-password
router.post("/change-password", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const body = ChangePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify current password
    const validPassword = await bcrypt.compare(body.currentPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(body.newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ error: "Password change failed" });
  }
});

// POST /api/auth/verify-email
router.post("/verify-email", async (req, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Verification token is required" });
    }

    // Find verification record
    const verification = await prisma.emailVerification.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!verification) {
      return res.status(400).json({ error: "Invalid verification token" });
    }

    if (verification.expiresAt < new Date()) {
      await prisma.emailVerification.delete({ where: { id: verification.id } });
      return res.status(400).json({ error: "Verification token has expired. Please request a new one." });
    }

    // Update user and delete token
    await prisma.$transaction([
      prisma.user.update({
        where: { id: verification.userId },
        data: { emailVerified: true },
      }),
      prisma.emailVerification.delete({ where: { id: verification.id } }),
    ]);

    // Send welcome email
    sendVerifiedWelcome(verification.user.email, verification.user.name || undefined).catch(console.error);

    return res.json({ message: "Email verified successfully! Welcome to Adult Store Kenya." });
  } catch (error) {
    console.error("Verify email error:", error);
    return res.status(500).json({ error: "Verification failed" });
  }
});

// POST /api/auth/resend-verification
router.post("/resend-verification", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.emailVerified) {
      return res.json({ message: "Email is already verified" });
    }

    // Delete existing token if any
    await prisma.emailVerification.deleteMany({ where: { userId: user.id } });

    // Create new verification token
    const verificationToken = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.emailVerification.create({
      data: {
        userId: user.id,
        token: verificationToken,
        expiresAt,
      },
    });

    // Send verification email
    await sendVerificationEmail(user.email, verificationToken, user.name || undefined);

    return res.json({ message: "Verification email sent. Please check your inbox." });
  } catch (error) {
    console.error("Resend verification error:", error);
    return res.status(500).json({ error: "Failed to resend verification email" });
  }
});

// POST /api/auth/logout
router.post("/logout", async (req, res: Response) => {
  // Invalidate refresh token if present
  const refreshToken = req.cookies?.refresh_token;
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } }).catch(() => {});
  }
  
  res.clearCookie("auth_token", { path: "/" });
  res.clearCookie("refresh_token", { path: "/api/auth" });
  return res.json({ message: "Logged out successfully" });
});

// POST /api/auth/logout-all - Logout from all devices
router.post("/logout-all", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await invalidateAllRefreshTokens(req.user!.id);
    res.clearCookie("auth_token", { path: "/" });
    res.clearCookie("refresh_token", { path: "/api/auth" });
    return res.json({ message: "Logged out from all devices" });
  } catch (error) {
    console.error("Logout all error:", error);
    return res.status(500).json({ error: "Logout failed" });
  }
});

// POST /api/auth/refresh - Refresh access token
router.post("/refresh", async (req, res: Response) => {
  try {
    const refreshToken = req.cookies?.refresh_token;
    
    if (!refreshToken) {
      return res.status(401).json({ error: "No refresh token" });
    }
    
    const result = await rotateRefreshToken(refreshToken);
    
    if (!result) {
      res.clearCookie("auth_token", { path: "/" });
      res.clearCookie("refresh_token", { path: "/api/auth" });
      return res.status(401).json({ error: "Invalid or expired refresh token" });
    }
    
    // Set new cookies
    res.cookie("auth_token", result.accessToken, COOKIE_OPTIONS);
    res.cookie("refresh_token", result.refreshToken, REFRESH_COOKIE_OPTIONS);
    
    return res.json({ 
      message: "Token refreshed",
      user: result.user,
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    return res.status(500).json({ error: "Token refresh failed" });
  }
});

// GET /api/auth/check - Check if user is authenticated (for frontend)
router.get("/check", authenticate, async (req: AuthRequest, res: Response) => {
  return res.json({ authenticated: true, user: req.user });
});

export default router;
