import { Router, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import prisma from "../lib/prisma";
import redis from "../lib/redis";
import logger from "../lib/logger";
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
import { logSecurityEvent } from "../middleware/securityEvents";
import { asyncHandler } from "../middleware/errorHandler";

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
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(strongPasswordRegex, "Password must contain uppercase, lowercase, number, and special character"),
});

const UpdateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  smsOptIn: z.boolean().optional(),
  orderHistoryDays: z.number().int().positive().nullable().optional(),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(strongPasswordRegex, "Password must contain uppercase, lowercase, number, and special character"),
});

// POST /api/auth/register
router.post("/register", asyncHandler(async (req, res: Response) => {
  try {
    const body = RegisterSchema.parse(req.body);
    const normalizedEmail = body.email.toLowerCase().trim();

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(body.password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        name: body.name,
        phone: body.phone,
      },
      select: { id: true, email: true, name: true, role: true },
    });

    // Generate tokens
    const accessToken = generateToken({ id: user.id, email: user.email, role: user.role, portal: "customer" });
    const refreshToken = await createRefreshToken(user.id);
    const verificationToken = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.emailVerification.create({
      data: {
        userId: user.id,
        token: verificationToken,
        expiresAt,
      },
    });

    // Set httpOnly cookies so user is logged in after registration
    res.cookie("auth_token", accessToken, COOKIE_OPTIONS);
    res.cookie("refresh_token", refreshToken, REFRESH_COOKIE_OPTIONS);

    // Send verification email (async, don't wait)
    sendVerificationEmail(user.email, verificationToken, user.name || undefined).catch(err => logger.error('send_verification_email_failed', { error: err }));

    // Also send legacy welcome email
    sendWelcomeEmail({ email: user.email, name: user.name || undefined });

    return res.status(201).json({
      message: "Registration successful. Please check your email to verify your account.",
      user,
    });
  } catch (error) {
    logger.error("Register error", { error });
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    return res.status(500).json({ error: "Registration failed" });
  }
}));

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
    // Redis down — fail open to avoid blocking all logins; rate limiting still applies
    logger.error("Redis unavailable for lockout check — allowing login");
    return { locked: false };
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

// Also track by IP to prevent trying many different emails
async function checkIpLockout(ip: string): Promise<{ locked: boolean; remainingTime?: number }> {
  try {
    const key = `lockout:ip:${ip}`;
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

async function recordFailedIpAttempt(ip: string): Promise<void> {
  try {
    const key = `lockout:ip:${ip}`;
    const data = await redis.get(key);
    const attempts = data ? JSON.parse(data) : { count: 0, lockedUntil: null };
    attempts.count += 1;
    if (attempts.count >= 15) {
      attempts.lockedUntil = Date.now() + 30 * 60 * 1000; // 30 min lockout after 15 failed attempts
    }
    await redis.set(key, JSON.stringify(attempts), "EX", 3600);
  } catch {}
}

async function clearIpAttempts(ip: string): Promise<void> {
  try { await redis.del(`lockout:ip:${ip}`); } catch {}
}

// POST /api/auth/login
router.post("/login", asyncHandler(async (req, res: Response) => {
  try {
    const body = LoginSchema.parse(req.body);
    const normalizedEmail = body.email.toLowerCase().trim();
    const clientIp = req.ip || "unknown";

    // Check IP-based lockout first (blocks brute-force across emails)
    const ipLockout = await checkIpLockout(clientIp);
    if (ipLockout.locked) {
      return res.status(429).json({
        error: `Too many failed attempts. Try again in ${ipLockout.remainingTime} minutes.`
      });
    }

    // Check for account lockout (Redis-backed)
    const lockoutStatus = await checkAccountLockout(normalizedEmail);
    if (lockoutStatus.locked) {
      return res.status(429).json({ 
        error: `Account temporarily locked. Try again in ${lockoutStatus.remainingTime} minutes.` 
      });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, name: true, password: true, role: true, isBlocked: true },
    });

    if (!user) {
      await recordFailedLogin(normalizedEmail);
      await recordFailedIpAttempt(clientIp);
      
      // Log security event for non-existent user attempt
      logSecurityEvent({
        type: "failed_login",
        email: normalizedEmail,
        ipAddress: clientIp,
        userAgent: req.headers["user-agent"] || "unknown",
        path: "/auth/login",
        details: { reason: "user_not_found" },
        severity: "low",
      }).catch(e => logger.error("security_event_log_failed", { error: String(e) }));
      
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ error: "Account has been suspended. Please contact support." });
    }

    // Verify password
    const validPassword = await bcrypt.compare(body.password, user.password);
    if (!validPassword) {
      await recordFailedLogin(normalizedEmail);
      await recordFailedIpAttempt(clientIp);
      
      // Log security event for invalid password
      logSecurityEvent({
        type: "failed_login",
        userId: user.id,
        email: normalizedEmail,
        ipAddress: clientIp,
        userAgent: req.headers["user-agent"] || "unknown",
        path: "/auth/login",
        details: { reason: "invalid_password" },
        severity: "low",
      }).catch(e => logger.error("security_event_log_failed", { error: String(e) }));
      
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Clear failed attempts on successful login
    await clearLoginAttempts(normalizedEmail);
    await clearIpAttempts(clientIp);

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

    // Generate tokens — portal based on admin role; sellers use "customer" portal
    // (seller access is determined by Seller record, not role)
    const portal = (user.role === "ADMIN" || user.role === "MANAGER") ? "admin" : "customer";
    const accessToken = generateToken({ id: user.id, email: user.email, role: user.role, portal });
    const refreshToken = await createRefreshToken(user.id);

    // Set httpOnly cookies
    res.cookie("auth_token", accessToken, COOKIE_OPTIONS);
    res.cookie("refresh_token", refreshToken, REFRESH_COOKIE_OPTIONS);

    // Check if user has a seller account
    const seller = await prisma.seller.findUnique({
      where: { userId: user.id },
      select: { id: true, status: true, storeName: true },
    });

    return res.json({
      message: "Login successful",
      user: { id: user.id, email: user.email, name: user.name, role: user.role, seller: seller || null },
    });
  } catch (error) {
    logger.error("Login error", { error });
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    return res.status(500).json({ error: "Login failed" });
  }
}));

// POST /api/auth/forgot-password
router.post("/forgot-password", asyncHandler(async (req, res: Response) => {
  try {
    const body = ForgotPasswordSchema.parse(req.body);

    // Per-email rate limiting: max 3 reset requests per hour
    try {
      const resetKey = `password-reset:${body.email}`;
      const resetData = await redis.get(resetKey);
      const resetCount = resetData ? parseInt(resetData, 10) : 0;
      if (resetCount >= 3) {
        return res.json({ message: "If the email exists, a reset link has been sent" });
      }
      await redis.set(resetKey, String(resetCount + 1), "EX", 3600);
    } catch {
      // Redis down — allow request but log it
    }

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
    logger.error("Forgot password error", { error });
    return res.status(500).json({ error: "Request failed" });
  }
}));

// POST /api/auth/reset-password
router.post("/reset-password", asyncHandler(async (req, res: Response) => {
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

    // Update password, delete reset token, and invalidate all sessions
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRecord.userId },
        data: { password: hashedPassword },
      }),
      prisma.passwordReset.delete({ where: { id: resetRecord.id } }),
      prisma.refreshToken.deleteMany({ where: { userId: resetRecord.userId } }),
    ]);

    return res.json({ message: "Password reset successful" });
  } catch (error) {
    logger.error("Reset password error", { error });
    return res.status(500).json({ error: "Reset failed" });
  }
}));

// GET /api/auth/me
router.get("/me", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
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
        smsOptIn: true,
        orderHistoryDays: true,
        createdAt: true,
        _count: { select: { orders: true, wishlist: true } },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Always check for seller record — any user can also be a seller
    const seller = await prisma.seller.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        storeName: true,
        storeSlug: true,
        status: true,
        tier: true,
        logo: true,
        rating: true,
        reviewCount: true,
      },
    });

    return res.json({ ...user, seller: seller || null });
  } catch (error) {
    logger.error("Get profile error", { error });
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
}));

// GET /api/auth/dashboard — rich customer dashboard data
router.get("/dashboard", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Parallel queries for performance
    const [
      recentOrders,
      orderStats,
      loyaltyAccount,
      wishlistCount,
      unreadMessages,
      referralCode,
      storeCredit,
    ] = await Promise.all([
      // Last 5 orders
      prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          currency: true,
          createdAt: true,
          items: { take: 3, select: { name: true, quantity: true, price: true, productId: true, product: { select: { images: { take: 1, select: { url: true } } } } } },
        },
      }),
      // Order aggregates
      prisma.order.aggregate({
        where: { userId, status: { notIn: ["CANCELLED"] } },
        _count: true,
        _sum: { totalAmount: true },
      }),
      // Loyalty
      prisma.loyaltyAccount.findUnique({
        where: { userId },
        select: { points: true, tier: true, lifetimePoints: true },
      }),
      // Wishlist count
      prisma.wishlistItem.count({ where: { userId } }),
      // Unread messages
      prisma.chatMessage.count({
        where: {
          conversation: { buyerId: userId },
          senderType: "SELLER",
          isRead: false,
        },
      }),
      // Referral code
      prisma.referralCode.findFirst({
        where: { userId },
        select: { code: true },
      }),
      // Store credit
      prisma.storeCredit.findUnique({
        where: { userId },
        select: { balance: true },
      }),
    ]);

    // Count orders by status
    const statusCounts = await prisma.order.groupBy({
      by: ["status"],
      where: { userId },
      _count: true,
    });
    const ordersByStatus: Record<string, number> = {};
    statusCounts.forEach((s) => { ordersByStatus[s.status] = s._count; });

    return res.json({
      recentOrders,
      stats: {
        totalOrders: orderStats._count,
        totalSpent: Number(orderStats._sum?.totalAmount || 0),
        wishlistCount,
        unreadMessages,
        ordersByStatus,
      },
      loyalty: loyaltyAccount || { points: 0, tier: "BRONZE", lifetimePoints: 0 },
      referralCode: referralCode?.code || null,
      storeCredit: Number(storeCredit?.balance || 0),
    });
  } catch (error) {
    logger.error("Dashboard error", { error });
    return res.status(500).json({ error: "Failed to load dashboard" });
  }
}));

// PUT /api/auth/me
router.put("/me", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const body = UpdateProfileSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: body,
      select: { id: true, email: true, name: true, phone: true, role: true },
    });

    return res.json({ message: "Profile updated", user });
  } catch (error) {
    logger.error("Update profile error", { error });
    return res.status(500).json({ error: "Update failed" });
  }
}));

// POST /api/auth/change-password
router.post("/change-password", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
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
    logger.error("Change password error", { error });
    return res.status(500).json({ error: "Password change failed" });
  }
}));

// POST /api/auth/verify-email
router.post("/verify-email", asyncHandler(async (req, res: Response) => {
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
    sendVerifiedWelcome(verification.user.email, verification.user.name || undefined).catch(err => logger.error('send_verified_welcome_failed', { error: err }));

    return res.json({ message: "Email verified successfully! Welcome to Pleasure Zone Uganda." });
  } catch (error) {
    logger.error("Verify email error", { error });
    return res.status(500).json({ error: "Verification failed" });
  }
}));

// POST /api/auth/resend-verification
router.post("/resend-verification", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
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
    logger.error("Resend verification error", { error });
    return res.status(500).json({ error: "Failed to resend verification email" });
  }
}));

// POST /api/auth/logout
router.post("/logout", asyncHandler(async (req, res: Response) => {
  // Invalidate refresh token if present
  const refreshToken = req.cookies?.refresh_token;
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } }).catch(() => {});
  }
  
  res.clearCookie("auth_token", { path: "/" });
  res.clearCookie("refresh_token", { path: "/api/auth" });
  return res.json({ message: "Logged out successfully" });
}));

// POST /api/auth/logout-all - Logout from all devices
router.post("/logout-all", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    await invalidateAllRefreshTokens(req.user!.id);
    res.clearCookie("auth_token", { path: "/" });
    res.clearCookie("refresh_token", { path: "/api/auth" });
    return res.json({ message: "Logged out from all devices" });
  } catch (error) {
    logger.error("Logout all error", { error });
    return res.status(500).json({ error: "Logout failed" });
  }
}));

// POST /api/auth/refresh - Refresh access token
router.post("/refresh", asyncHandler(async (req, res: Response) => {
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
    logger.error("Refresh token error", { error });
    return res.status(500).json({ error: "Token refresh failed" });
  }
}));

// GET /api/auth/check - Check if user is authenticated (for frontend)
router.get("/check", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  return res.json({ authenticated: true, user: req.user });
}));

export default router;
