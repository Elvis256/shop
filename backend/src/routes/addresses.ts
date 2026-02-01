import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

// All address routes require authentication
router.use(authenticate);

const AddressSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(10),
  street: z.string().min(5),
  city: z.string().min(2),
  county: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().default("Kenya"),
  isDefault: z.boolean().default(false),
});

// GET /api/addresses
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const addresses = await prisma.address.findMany({
      where: { userId: req.user!.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    return res.json({ addresses });
  } catch (error) {
    console.error("Get addresses error:", error);
    return res.status(500).json({ error: "Failed to fetch addresses" });
  }
});

// POST /api/addresses
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const body = AddressSchema.parse(req.body);

    // If this is set as default, unset other defaults
    if (body.isDefault) {
      await prisma.address.updateMany({
        where: { userId: req.user!.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    // If this is the first address, make it default
    const count = await prisma.address.count({ where: { userId: req.user!.id } });
    if (count === 0) {
      body.isDefault = true;
    }

    const address = await prisma.address.create({
      data: { ...body, userId: req.user!.id },
    });

    return res.status(201).json({ message: "Address created", address });
  } catch (error) {
    console.error("Create address error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    return res.status(500).json({ error: "Failed to create address" });
  }
});

// PUT /api/addresses/:id
router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const body = AddressSchema.partial().parse(req.body);

    // Verify ownership
    const address = await prisma.address.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!address) {
      return res.status(404).json({ error: "Address not found" });
    }

    // If setting as default, unset others
    if (body.isDefault) {
      await prisma.address.updateMany({
        where: { userId: req.user!.id, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.address.update({
      where: { id },
      data: body,
    });

    return res.json({ message: "Address updated", address: updated });
  } catch (error) {
    console.error("Update address error:", error);
    return res.status(500).json({ error: "Failed to update address" });
  }
});

// DELETE /api/addresses/:id
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const address = await prisma.address.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!address) {
      return res.status(404).json({ error: "Address not found" });
    }

    await prisma.address.delete({ where: { id } });

    // If deleted was default, make another one default
    if (address.isDefault) {
      const another = await prisma.address.findFirst({
        where: { userId: req.user!.id },
        orderBy: { createdAt: "desc" },
      });
      if (another) {
        await prisma.address.update({
          where: { id: another.id },
          data: { isDefault: true },
        });
      }
    }

    return res.json({ message: "Address deleted" });
  } catch (error) {
    console.error("Delete address error:", error);
    return res.status(500).json({ error: "Failed to delete address" });
  }
});

// POST /api/addresses/:id/set-default
router.post("/:id/set-default", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const address = await prisma.address.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!address) {
      return res.status(404).json({ error: "Address not found" });
    }

    await prisma.$transaction([
      prisma.address.updateMany({
        where: { userId: req.user!.id, isDefault: true },
        data: { isDefault: false },
      }),
      prisma.address.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);

    return res.json({ message: "Default address updated" });
  } catch (error) {
    console.error("Set default address error:", error);
    return res.status(500).json({ error: "Failed to set default address" });
  }
});

export default router;
