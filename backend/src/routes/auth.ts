import { Router, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import prisma from "../lib/prisma";
import { generateToken, authenticate, AuthRequest } from "../middleware/auth";
import { sendWelcomeEmail, sendPasswordResetEmail } from "../lib/email";

const router = Router();

// Validation schemas
const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
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

    // Generate token
    const token = generateToken({ id: user.id, email: user.email, role: user.role });

    // Send welcome email (async, don't wait)
    sendWelcomeEmail({ email: user.email, name: user.name || undefined });

    return res.status(201).json({
      message: "Registration successful",
      user,
      token,
    });
  } catch (error) {
    console.error("Register error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    return res.status(500).json({ error: "Registration failed" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res: Response) => {
  try {
    const body = LoginSchema.parse(req.body);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true, email: true, name: true, password: true, role: true },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Verify password
    const validPassword = await bcrypt.compare(body.password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Generate token
    const token = generateToken({ id: user.id, email: user.email, role: user.role });

    return res.json({
      message: "Login successful",
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token,
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

export default router;
