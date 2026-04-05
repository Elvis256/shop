import { Router, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma";
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

// POST /api/seller/auth/login
router.post("/login", async (req, res: Response) => {
  try {
    const body = SellerLoginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true, email: true, name: true, password: true, role: true },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const validPassword = await bcrypt.compare(body.password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (user.role !== "SELLER") {
      return res.status(403).json({ error: "This account is not registered as a vendor" });
    }

    // Check seller status
    const seller = await prisma.seller.findUnique({
      where: { userId: user.id },
      select: { status: true },
    });

    if (!seller || seller.status !== "APPROVED") {
      return res.status(403).json({ 
        error: seller?.status === "PENDING" 
          ? "Your vendor application is still under review" 
          : "Your vendor account is not active" 
      });
    }

    const accessToken = generateToken({ id: user.id, email: user.email, role: user.role, portal: "seller" });
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
