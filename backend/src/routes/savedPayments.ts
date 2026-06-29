import { Router, Response } from "express";
import prisma from "../lib/prisma";
import logger from "../lib/logger";
import { authenticate, AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { z } from "zod";

const router = Router();

const AddPaymentSchema = z.object({
  type: z.enum(["MOBILE_MONEY", "CARD"]),
  label: z.string().max(50).optional(),
  network: z.string().max(20).optional(),
  phone: z.string().min(10).max(15).optional(),
  last4: z.string().length(4).optional(),
  isDefault: z.boolean().optional(),
});

function maskPhone(phone: string): string {
  if (phone.length < 7) return phone;
  return phone.slice(0, 4) + "***" + phone.slice(-3);
}

// GET /api/saved-payments — list user's methods
router.get("/", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const methods = await prisma.savedPaymentMethod.findMany({
      where: { userId: req.user!.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
    return res.json(methods);
  } catch (error) {
    logger.error("List saved payments error", { error });
    return res.status(500).json({ error: "Failed to fetch saved payments" });
  }
}));

// POST /api/saved-payments — add new method (max 5)
router.post("/", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const body = AddPaymentSchema.parse(req.body);
    const userId = req.user!.id;

    // Enforce max 5
    const count = await prisma.savedPaymentMethod.count({ where: { userId } });
    if (count >= 5) {
      return res.status(400).json({ error: "Maximum of 5 saved payment methods allowed" });
    }

    // For mobile money, phone is required
    if (body.type === "MOBILE_MONEY" && !body.phone) {
      return res.status(400).json({ error: "Phone number is required for mobile money" });
    }

    // Check duplicate phone
    if (body.phone) {
      const existing = await prisma.savedPaymentMethod.findUnique({
        where: { userId_phone: { userId, phone: body.phone } },
      });
      if (existing) {
        return res.status(400).json({ error: "This phone number is already saved" });
      }
    }

    // If setting as default, unset existing defaults
    if (body.isDefault) {
      await prisma.savedPaymentMethod.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const method = await prisma.savedPaymentMethod.create({
      data: {
        userId,
        type: body.type,
        label: body.label || null,
        network: body.network || null,
        phone: body.phone || null,
        phoneMask: body.phone ? maskPhone(body.phone) : null,
        last4: body.last4 || null,
        isDefault: body.isDefault || count === 0, // first one is auto-default
      },
    });

    return res.status(201).json(method);
  } catch (error) {
    logger.error("Add saved payment error", { error });
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    return res.status(500).json({ error: "Failed to add payment method" });
  }
}));

// PUT /api/saved-payments/:id — update label/default
router.put("/:id", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { label, isDefault } = req.body;

    const method = await prisma.savedPaymentMethod.findFirst({ where: { id, userId } });
    if (!method) {
      return res.status(404).json({ error: "Payment method not found" });
    }

    if (isDefault) {
      await prisma.savedPaymentMethod.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.savedPaymentMethod.update({
      where: { id },
      data: {
        ...(label !== undefined ? { label } : {}),
        ...(isDefault !== undefined ? { isDefault } : {}),
      },
    });

    return res.json(updated);
  } catch (error) {
    logger.error("Update saved payment error", { error });
    return res.status(500).json({ error: "Failed to update payment method" });
  }
}));

// DELETE /api/saved-payments/:id — remove
router.delete("/:id", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const method = await prisma.savedPaymentMethod.findFirst({ where: { id, userId } });
    if (!method) {
      return res.status(404).json({ error: "Payment method not found" });
    }

    await prisma.savedPaymentMethod.delete({ where: { id } });

    // If deleted was default, make the next one default
    if (method.isDefault) {
      const next = await prisma.savedPaymentMethod.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      if (next) {
        await prisma.savedPaymentMethod.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }

    return res.json({ message: "Payment method removed" });
  } catch (error) {
    logger.error("Delete saved payment error", { error });
    return res.status(500).json({ error: "Failed to remove payment method" });
  }
}));

export default router;
