import { Router, Response } from "express";
import { z } from "zod";
import multer from "multer";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";
import { uploadMultiple, validateUploadedFiles } from "../../middleware/upload";

const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

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
          _count: { select: { orderItems: true, reviews: true, variants: true } },
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
        variantCount: p._count.variants,
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

const optStr = (schema = z.string()) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), schema.optional());

const ProductSchema = z.object({
  name: z.string().min(2),
  slug: optStr(z.string().min(2)),
  description: optStr(),
  price: z.number().positive(),
  comparePrice: z.number().positive().optional().nullable(),
  sku: optStr(),
  barcode: optStr(),
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
    if ((error as any)?.code === "P2002") {
      const field = (error as any)?.meta?.target?.[0] || "field";
      return res.status(400).json({ error: `A product with this ${field} already exists` });
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

// PATCH /api/admin/products/bulk-stock
router.patch("/bulk-stock", async (req: AuthRequest, res: Response) => {
  try {
    const { updates } = z
      .object({
        updates: z.array(z.object({ id: z.string(), stock: z.number().int().min(0) })),
      })
      .parse(req.body);

    await prisma.$transaction(
      updates.map((u) =>
        prisma.product.update({ where: { id: u.id }, data: { stock: u.stock } })
      )
    );

    return res.json({ message: "Stock updated", count: updates.length });
  } catch (error) {
    console.error("Bulk stock update error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    return res.status(500).json({ error: "Failed to update stock" });
  }
});

// POST /api/admin/products/import-csv
router.post("/import-csv", csvUpload.single("file"), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No CSV file uploaded" });
    }

    const content = req.file.buffer.toString("utf-8");
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      return res.status(400).json({ error: "CSV must have a header row and at least one data row" });
    }

    // Parse header - expected: name,description,price,stock,category,sku
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const getIdx = (name: string) => headers.indexOf(name);
    const nameIdx = getIdx("name");
    const priceIdx = getIdx("price");

    if (nameIdx === -1 || priceIdx === -1) {
      return res.status(400).json({ error: "CSV must have 'name' and 'price' columns" });
    }

    const descIdx = getIdx("description");
    const stockIdx = getIdx("stock");
    const categoryIdx = getIdx("category");
    const skuIdx = getIdx("sku");

    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    // Cache category lookups
    const categoryCache: Record<string, string | null> = {};

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Simple CSV parse (handles quoted fields)
      const cols: string[] = [];
      let inQuotes = false;
      let cell = "";
      for (let ci = 0; ci < line.length; ci++) {
        const ch = line[ci];
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === "," && !inQuotes) { cols.push(cell.trim()); cell = ""; continue; }
        cell += ch;
      }
      cols.push(cell.trim());

      const name = cols[nameIdx];
      const price = parseFloat(cols[priceIdx]);

      if (!name || isNaN(price)) {
        errors.push(`Row ${i + 1}: invalid name or price`);
        failed++;
        continue;
      }

      try {
        const categoryName = categoryIdx >= 0 ? cols[categoryIdx]?.trim() : "";
        let categoryId: string | null = null;

        if (categoryName) {
          if (categoryCache[categoryName] !== undefined) {
            categoryId = categoryCache[categoryName];
          } else {
            const cat = await prisma.category.findFirst({
              where: { name: { equals: categoryName, mode: "insensitive" } },
            });
            categoryId = cat?.id || null;
            categoryCache[categoryName] = categoryId;
          }
        }

        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") +
          "-" + Date.now() + "-" + i;

        await prisma.product.create({
          data: {
            name,
            slug,
            description: descIdx >= 0 ? (cols[descIdx] || "") : "",
            price,
            stock: stockIdx >= 0 ? (parseInt(cols[stockIdx]) || 0) : 0,
            sku: skuIdx >= 0 ? (cols[skuIdx] || null) : null,
            categoryId,
            status: "ACTIVE",
          },
        });
        imported++;
      } catch (err: any) {
        errors.push(`Row ${i + 1}: ${err?.message || "unknown error"}`);
        failed++;
      }
    }

    return res.json({ imported, failed, errors: errors.slice(0, 20) });
  } catch (error) {
    console.error("CSV import error:", error);
    return res.status(500).json({ error: "Failed to import CSV" });
  }
});

export default router;
