import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authenticate, AuthRequest } from "../middleware/auth";

const prisma = new PrismaClient();
const router = Router();

// All routes require admin authentication
router.use(authenticate);

// Middleware to check admin role
const requireAdmin = (req: AuthRequest, res: Response, next: Function) => {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

router.use(requireAdmin);

// GET /api/admin/staff - List all staff members (ADMIN, MANAGER roles)
router.get("/", async (_req: Request, res: Response) => {
  try {
    const staff = await prisma.user.findMany({
      where: {
        role: { in: ["ADMIN", "MANAGER"] },
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            activityLogs: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({
      staff: staff.map((s) => ({
        ...s,
        activityCount: s._count.activityLogs,
        _count: undefined,
      })),
    });
  } catch (error) {
    console.error("List staff error:", error);
    return res.status(500).json({ error: "Failed to fetch staff" });
  }
});

// POST /api/admin/staff - Create new staff member
const CreateStaffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(["ADMIN", "MANAGER"]),
  phone: z.string().optional(),
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const data = CreateStaffSchema.parse(req.body);

    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      return res.status(400).json({ error: "Email already in use" });
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        role: data.role,
        phone: data.phone,
        emailVerified: true, // Staff accounts are pre-verified
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    return res.status(201).json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid data", details: error.errors });
    }
    console.error("Create staff error:", error);
    return res.status(500).json({ error: "Failed to create staff member" });
  }
});

// GET /api/admin/staff/:id - Get staff member details
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findFirst({
      where: {
        id,
        role: { in: ["ADMIN", "MANAGER"] },
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        activityLogs: {
          take: 20,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            action: true,
            entityType: true,
            description: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "Staff member not found" });
    }

    return res.json(user);
  } catch (error) {
    console.error("Get staff error:", error);
    return res.status(500).json({ error: "Failed to fetch staff member" });
  }
});

// PUT /api/admin/staff/:id - Update staff member
const UpdateStaffSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  role: z.enum(["ADMIN", "MANAGER"]).optional(),
  password: z.string().min(8).optional(),
});

router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = UpdateStaffSchema.parse(req.body);

    // Prevent self-demotion
    if (req.user?.id === id && data.role && data.role !== "ADMIN") {
      return res.status(400).json({ error: "Cannot demote yourself" });
    }

    const updateData: Record<string, unknown> = {};
    if (data.name) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.role) updateData.role = data.role;
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 12);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        emailVerified: true,
        updatedAt: true,
      },
    });

    return res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid data", details: error.errors });
    }
    console.error("Update staff error:", error);
    return res.status(500).json({ error: "Failed to update staff member" });
  }
});

// DELETE /api/admin/staff/:id - Remove staff member
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (req.user?.id === id) {
      return res.status(400).json({ error: "Cannot delete yourself" });
    }

    // Check if user exists and is staff
    const user = await prisma.user.findFirst({
      where: {
        id,
        role: { in: ["ADMIN", "MANAGER"] },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "Staff member not found" });
    }

    // Demote to CUSTOMER instead of deleting (preserves data)
    await prisma.user.update({
      where: { id },
      data: { role: "CUSTOMER" },
    });

    return res.json({ message: "Staff member removed" });
  } catch (error) {
    console.error("Delete staff error:", error);
    return res.status(500).json({ error: "Failed to remove staff member" });
  }
});

export default router;
