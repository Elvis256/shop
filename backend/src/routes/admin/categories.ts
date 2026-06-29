import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";
import { uploadSingle, validateUploadedFiles } from "../../middleware/upload";
import { logger } from "../../lib/logger";
import { asyncHandler } from "../../middleware/errorHandler";

const router = Router();

router.use(authenticate, requireAdmin);

// GET /api/admin/categories
router.get("/", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { products: true, children: true } },
      },
      orderBy: { name: "asc" },
    });

    return res.json({ categories });
  } catch (error) {
    logger.error("Admin get categories error", { error });
    return res.status(500).json({ error: "Failed to fetch categories" });
  }
}));

const CategorySchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).optional(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional().nullable(),
  parentId: z.string().optional().nullable(),
});

// POST /api/admin/categories
router.post("/", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const body = CategorySchema.parse(req.body);

    // Generate slug if not provided
    if (!body.slug) {
      body.slug = body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    }

    // Check slug uniqueness
    const existing = await prisma.category.findUnique({ where: { slug: body.slug } });
    if (existing) {
      return res.status(400).json({ error: "Slug already in use" });
    }

    const category = await prisma.category.create({ data: body as any });

    return res.status(201).json({ message: "Category created", category });
  } catch (error) {
    logger.error("Admin create category error", { error });
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    return res.status(500).json({ error: "Failed to create category" });
  }
}));

// PUT /api/admin/categories/:id
router.put("/:id", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const body = CategorySchema.partial().parse(req.body);

    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    // Check slug uniqueness if changing
    if (body.slug && body.slug !== category.slug) {
      const existing = await prisma.category.findFirst({
        where: { slug: body.slug, id: { not: id } },
      });
      if (existing) {
        return res.status(400).json({ error: "Slug already in use" });
      }
    }

    // Prevent circular parent references (walk up chain, max 10 levels)
    if (body.parentId) {
      if (body.parentId === id) {
        return res.status(400).json({ error: "Category cannot be its own parent" });
      }
      let currentId: string | null = body.parentId;
      for (let depth = 0; depth < 10 && currentId; depth++) {
        const ancestor: { parentId: string | null } | null = await prisma.category.findUnique({
          where: { id: currentId },
          select: { parentId: true },
        });
        if (!ancestor) break;
        if (ancestor.parentId === id) {
          return res.status(400).json({ error: "Circular parent reference detected" });
        }
        currentId = ancestor.parentId;
      }
    }

    const updated = await prisma.category.update({
      where: { id },
      data: body as any,
    });

    return res.json({ message: "Category updated", category: updated });
  } catch (error) {
    logger.error("Admin update category error", { error });
    return res.status(500).json({ error: "Failed to update category" });
  }
}));

// POST /api/admin/categories/:id/image - upload image file
router.post("/:id/image", uploadSingle, validateUploadedFiles, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const file = req.file as Express.Multer.File | undefined;

    if (!file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    const imageUrl = `/uploads/${file.filename}`;
    const updated = await prisma.category.update({
      where: { id },
      data: { imageUrl },
    });

    return res.json({ message: "Image uploaded", imageUrl, category: updated });
  } catch (error) {
    logger.error("Admin category image upload error", { error });
    return res.status(500).json({ error: "Failed to upload image" });
  }
}));

// DELETE /api/admin/categories/:id
router.delete("/:id", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true, children: true } } },
    });

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    if (category._count.products > 0) {
      return res.status(400).json({
        error: "Cannot delete category with products. Move products first.",
      });
    }

    if (category._count.children > 0) {
      return res.status(400).json({
        error: "Cannot delete category with subcategories. Delete subcategories first.",
      });
    }

    await prisma.category.delete({ where: { id } });

    return res.json({ message: "Category deleted" });
  } catch (error) {
    logger.error("Admin delete category error", { error });
    return res.status(500).json({ error: "Failed to delete category" });
  }
}));

export default router;
