import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";
import {
  searchProducts,
  getProductDetail,
  getShippingInfo,
  calculateSellingPrice,
} from "../../services/cjdropshipping";

const router = Router();
router.use(authenticate, requireAdmin);

// GET /api/admin/cj/search?q=keyword&page=1
router.get("/search", async (req: AuthRequest, res: Response) => {
  try {
    const q = (req.query.q as string) || "";
    if (!q) return res.status(400).json({ error: "Search query is required" });
    const page = parseInt(req.query.page as string) || 1;
    const result = await searchProducts(q, page);
    return res.json(result);
  } catch (error: any) {
    console.error("CJ search error:", error.message);
    return res.status(500).json({ error: error.message || "Search failed" });
  }
});

// GET /api/admin/cj/product/:productId
router.get("/product/:productId", async (req: AuthRequest, res: Response) => {
  try {
    const { productId } = req.params;
    const [detail, shipping] = await Promise.all([
      getProductDetail(productId),
      getShippingInfo(productId),
    ]);
    return res.json({ ...detail, shippingOptions: shipping });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to get product details" });
  }
});

// POST /api/admin/cj/import
const ImportSchema = z.object({
  cjProductId: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  markupType: z.enum(["PERCENTAGE", "FIXED"]),
  markupValue: z.number().positive(),
  tags: z.array(z.string()).optional(),
});

router.post("/import", async (req: AuthRequest, res: Response) => {
  try {
    const body = ImportSchema.parse(req.body);
    const detail = await getProductDetail(body.cjProductId);

    // Convert USD prices to UGX (store base currency)
    const usdCurrency = await prisma.currency.findUnique({ where: { code: "USD" } });
    const usdToUgx = usdCurrency ? Math.round(1 / Number(usdCurrency.exchangeRate)) : 3700;
    const costUgx = Math.round(detail.price * usdToUgx);

    const sellingPrice = calculateSellingPrice(costUgx, body.markupType, body.markupValue);
    const slug = (body.name || detail.title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 80) + `-${Date.now().toString(36)}`;

    const product = await prisma.product.create({
      data: {
        name: body.name || detail.title,
        slug,
        description: body.description || (() => {
          const raw = detail.description || "";
          return raw
            .replace(/<img[^>]*>/gi, "")
            .replace(/<b>Product Image:<\/b>\s*(<br\s*\/?>)*/gi, "")
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/?(b|strong|i|em|u|p|div|span|a|ul|ol|li|h[1-6])[^>]*>/gi, "")
            .replace(/&nbsp;/gi, " ")
            .replace(/&amp;/gi, "&")
            .replace(/&lt;/gi, "<")
            .replace(/&gt;/gi, ">")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
        })(),
        price: sellingPrice,
        currency: "UGX",
        cjProductId: body.cjProductId,
        cjUrl: detail.productUrl,
        cjCost: costUgx,
        markupType: body.markupType,
        markupValue: body.markupValue,
        cjAutoSync: true,
        lastSyncedAt: new Date(),
        stock: detail.variants.reduce((sum, v) => sum + v.variantStock, 0) || 100,
        trackInventory: false,
        allowBackorder: true,
        categoryId: body.categoryId || null,
        tags: body.tags || [],
        status: "ACTIVE",
        images: {
          create: detail.images.slice(0, 10).map((url, i) => ({
            url,
            alt: `${body.name || detail.title} - Image ${i + 1}`,
            position: i,
          })),
        },
        hasVariants: detail.variants.length > 1,
        variants: detail.variants.length > 1
          ? {
              create: detail.variants.map((v) => ({
                name: v.variantName || "Default",
                price: calculateSellingPrice(Math.round(v.variantPrice * usdToUgx), body.markupType, body.markupValue),
                stock: v.variantStock,
                sku: `CJ-${body.cjProductId}-${v.vid}`,
              })),
            }
          : undefined,
      },
      include: { images: true, variants: true },
    });

    return res.json({ message: "Product imported from CJ Dropshipping", product });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    return res.status(500).json({ error: error.message || "Import failed" });
  }
});

// PUT /api/admin/cj/products/:id/markup
const MarkupSchema = z.object({
  markupType: z.enum(["PERCENTAGE", "FIXED"]),
  markupValue: z.number().positive(),
});

router.put("/products/:id/markup", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const body = MarkupSchema.parse(req.body);

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product || !product.cjProductId) {
      return res.status(404).json({ error: "CJ product not found" });
    }

    const newPrice = calculateSellingPrice(Number(product.cjCost), body.markupType, body.markupValue);

    const updated = await prisma.product.update({
      where: { id },
      data: { markupType: body.markupType, markupValue: body.markupValue, price: newPrice },
    });

    return res.json({ message: "Markup updated", product: updated });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    return res.status(500).json({ error: error.message || "Update failed" });
  }
});

// GET /api/admin/cj/products
router.get("/products", async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: { cjProductId: { not: null } },
        include: { images: { take: 1, orderBy: { position: "asc" } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.product.count({ where: { cjProductId: { not: null } } }),
    ]);

    return res.json({ products, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/cj/sync
router.post("/sync", async (req: AuthRequest, res: Response) => {
  try {
    const productId = req.body.productId;
    const where: any = { cjProductId: { not: null }, cjAutoSync: true };
    if (productId) where.id = productId;

    // Get USD→UGX rate for price conversion
    const usdCurrency = await prisma.currency.findUnique({ where: { code: "USD" } });
    const usdToUgx = usdCurrency ? Math.round(1 / Number(usdCurrency.exchangeRate)) : 3700;

    const products = await prisma.product.findMany({ where, take: 50 });
    const results: Array<{ id: string; name: string; status: string; changes?: any }> = [];

    for (const product of products) {
      try {
        const detail = await getProductDetail(product.cjProductId!);
        const oldCost = Number(product.cjCost);
        const newCostUgx = Math.round(detail.price * usdToUgx);
        const changes: any = {};

        if (Math.abs(oldCost - newCostUgx) > 1) changes.price = { old: oldCost, new: newCostUgx };

        const newSellingPrice = calculateSellingPrice(
          newCostUgx,
          product.markupType as "PERCENTAGE" | "FIXED",
          Number(product.markupValue),
        );

        const newStock = detail.variants.reduce((sum, v) => sum + v.variantStock, 0) || 100;
        if (product.stock !== newStock) changes.stock = { old: product.stock, new: newStock };

        // Use raw SQL for Decimal price fields to avoid Prisma Decimal persistence issues
        await prisma.$executeRawUnsafe(
          `UPDATE "Product" SET "cjCost" = $1, price = $2, currency = 'UGX', stock = $3, "lastSyncedAt" = NOW() WHERE id = $4`,
          newCostUgx, newSellingPrice, newStock, product.id,
        );

        // Update variant prices too
        if (detail.variants.length > 0) {
          const existingVariants = await prisma.productVariant.findMany({ where: { productId: product.id } });
          for (const ev of existingVariants) {
            const matchingDetail = detail.variants.find((v) => (v.variantName || "Default") === ev.name);
            if (matchingDetail) {
              const variantPriceUgx = calculateSellingPrice(
                Math.round(matchingDetail.variantPrice * usdToUgx),
                product.markupType as "PERCENTAGE" | "FIXED",
                Number(product.markupValue),
              );
              await prisma.$executeRawUnsafe(
                `UPDATE "ProductVariant" SET price = $1, stock = $2 WHERE id = $3`,
                variantPriceUgx, matchingDetail.variantStock, ev.id,
              );
            }
          }
        }

        results.push({
          id: product.id,
          name: product.name,
          status: Object.keys(changes).length ? "updated" : "unchanged",
          changes: Object.keys(changes).length ? changes : undefined,
        });
      } catch (err: any) {
        results.push({ id: product.id, name: product.name, status: `error: ${err.message}` });
      }
    }

    return res.json({ synced: results.length, results });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Sync failed" });
  }
});

// GET /api/admin/cj/orders
router.get("/orders", async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const status = req.query.status as string;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.cJOrder.findMany({
        where,
        include: {
          order: { select: { orderNumber: true, customerName: true, customerEmail: true, totalAmount: true, currency: true } },
          product: { select: { name: true, images: { take: 1, orderBy: { position: "asc" } } } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.cJOrder.count({ where }),
    ]);

    return res.json({ orders, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PUT /api/admin/cj/settings
const SettingsSchema = z.object({
  email: z.string().email(),
  apiKey: z.string().min(1),
});

router.put("/settings", async (req: AuthRequest, res: Response) => {
  try {
    const body = SettingsSchema.parse(req.body);
    const keys = [
      { key: "cj_email", value: body.email },
      { key: "cj_api_key", value: body.apiKey },
    ];
    for (const { key, value } of keys) {
      await prisma.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }
    return res.json({ message: "CJ Dropshipping settings saved" });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/cj/settings
router.get("/settings", async (req: AuthRequest, res: Response) => {
  try {
    const settings = await prisma.setting.findMany({
      where: { key: { in: ["cj_email", "cj_api_key"] } },
    });
    const result: any = {};
    for (const s of settings) {
      if (s.key === "cj_api_key") {
        result[s.key] = s.value ? `${s.value.substring(0, 6)}...${s.value.slice(-4)}` : "";
      } else {
        result[s.key] = s.value;
      }
    }
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
