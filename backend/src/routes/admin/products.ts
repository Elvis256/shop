import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";
import { uploadMultiple, validateUploadedFiles } from "../../middleware/upload";

const router = Router();

router.use(authenticate, requireAdmin);

// GET /api/admin/products
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const {
      search,
      category,
      status,
      stock,
      sort = "createdAt",
      order = "desc",
      page = "1",
      limit = "20",
    } = req.query;

    const take = Math.min(parseInt(limit as string) || 20, 100);
    const skip = (Math.max(parseInt(page as string) || 1, 1) - 1) * take;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
      ];
    }

    if (category) {
      where.categoryId = category;
    }

    if (status) {
      where.status = status;
    }

    if (stock === "low") {
      where.stock = { lte: 10 };
    } else if (stock === "out") {
      where.stock = 0;
    }

    const orderBy: any = {};
    orderBy[sort as string] = order;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        take,
        skip,
        include: {
          category: { select: { name: true } },
          images: { take: 1, orderBy: { position: "asc" } },
          _count: { select: { orderItems: true, reviews: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return res.json({
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        sku: p.sku,
        price: p.price,
        comparePrice: p.comparePrice,
        stock: p.stock,
        status: p.status,
        featured: p.featured,
        category: p.category?.name,
        imageUrl: p.images[0]?.url || null,
        sales: p._count.orderItems,
        reviews: p._count.reviews,
        createdAt: p.createdAt,
      })),
      pagination: {
        total,
        page: Math.floor(skip / take) + 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error("Admin get products error:", error);
    return res.status(500).json({ error: "Failed to fetch products" });
  }
});

// GET /api/admin/products/:id
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        images: { orderBy: { position: "asc" } },
      },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    return res.json(product);
  } catch (error) {
    console.error("Admin get product error:", error);
    return res.status(500).json({ error: "Failed to fetch product" });
  }
});

const emptyToUndefined = z.string().transform((v) => v.trim() === "" ? undefined : v);

const ProductSchema = z.object({
  name: z.string().min(2),
  slug: emptyToUndefined.pipe(z.string().min(2)).optional(),
  description: emptyToUndefined.pipe(z.string()).optional(),
  price: z.number().positive(),
  comparePrice: z.number().positive().optional().nullable(),
  sku: emptyToUndefined.pipe(z.string()).optional(),
  barcode: emptyToUndefined.pipe(z.string()).optional(),
  stock: z.number().int().min(0).default(0),
  lowStockAlert: z.number().int().min(0).default(5),
  trackInventory: z.boolean().default(true),
  allowBackorder: z.boolean().default(false),
  categoryId: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
  featured: z.boolean().default(false),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
});

// POST /api/admin/products
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const body = ProductSchema.parse(req.body);

    // Generate slug if not provided
    if (!body.slug) {
      body.slug = body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    }

    // Check slug uniqueness
    const existing = await prisma.product.findUnique({ where: { slug: body.slug } });
    if (existing) {
      body.slug = `${body.slug}-${Date.now()}`;
    }

    const product = await prisma.product.create({
      data: body as any,
    });

    return res.status(201).json(product);
  } catch (error) {
    console.error("Admin create product error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    return res.status(500).json({ error: "Failed to create product" });
  }
});

// PUT /api/admin/products/:id
router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const body = ProductSchema.partial().parse(req.body);

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Check slug uniqueness if changing
    if (body.slug && body.slug !== product.slug) {
      const existing = await prisma.product.findFirst({
        where: { slug: body.slug, id: { not: id } },
      });
      if (existing) {
        return res.status(400).json({ error: "Slug already in use" });
      }
    }

    const updated = await prisma.product.update({
      where: { id },
      data: body as any,
    });

    return res.json({ message: "Product updated", product: updated });
  } catch (error) {
    console.error("Admin update product error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    return res.status(500).json({ error: "Failed to update product" });
  }
});

// DELETE /api/admin/products/:id
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Soft delete by archiving
    await prisma.product.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });

    return res.json({ message: "Product archived" });
  } catch (error) {
    console.error("Admin delete product error:", error);
    return res.status(500).json({ error: "Failed to delete product" });
  }
});

// POST /api/admin/products/:id/images
router.post("/:id/images", uploadMultiple, validateUploadedFiles, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Get current max position
    const maxPos = await prisma.productImage.aggregate({
      where: { productId: id },
      _max: { position: true },
    });

    let position = (maxPos._max.position || 0) + 1;

    const images = await Promise.all(
      files.map((file) =>
        prisma.productImage.create({
          data: {
            productId: id,
            url: `/uploads/${file.filename}`,
            position: position++,
          },
        })
      )
    );

    return res.status(201).json({ message: "Images uploaded", images });
  } catch (error) {
    console.error("Admin upload images error:", error);
    return res.status(500).json({ error: "Failed to upload images" });
  }
});

// DELETE /api/admin/products/:id/images/:imageId
router.delete("/:id/images/:imageId", async (req: AuthRequest, res: Response) => {
  try {
    const { id, imageId } = req.params;

    const image = await prisma.productImage.findFirst({
      where: { id: imageId, productId: id },
    });

    if (!image) {
      return res.status(404).json({ error: "Image not found" });
    }

    await prisma.productImage.delete({ where: { id: imageId } });

    return res.json({ message: "Image deleted" });
  } catch (error) {
    console.error("Admin delete image error:", error);
    return res.status(500).json({ error: "Failed to delete image" });
  }
});

// POST /api/admin/products/bulk
router.post("/bulk", async (req: AuthRequest, res: Response) => {
  try {
    const { action, ids } = z
      .object({
        action: z.enum(["activate", "archive", "delete", "feature", "unfeature"]),
        ids: z.array(z.string()),
      })
      .parse(req.body);

    let result;
    switch (action) {
      case "activate":
        result = await prisma.product.updateMany({
          where: { id: { in: ids } },
          data: { status: "ACTIVE" },
        });
        break;
      case "archive":
        result = await prisma.product.updateMany({
          where: { id: { in: ids } },
          data: { status: "ARCHIVED" },
        });
        break;
      case "feature":
        result = await prisma.product.updateMany({
          where: { id: { in: ids } },
          data: { featured: true },
        });
        break;
      case "unfeature":
        result = await prisma.product.updateMany({
          where: { id: { in: ids } },
          data: { featured: false },
        });
        break;
      case "delete":
        result = await prisma.product.deleteMany({
          where: { id: { in: ids } },
        });
        break;
    }

    return res.json({ message: `Bulk ${action} completed`, affected: result.count });
  } catch (error) {
    console.error("Admin bulk action error:", error);
    return res.status(500).json({ error: "Bulk action failed" });
  }
});

export default router;
