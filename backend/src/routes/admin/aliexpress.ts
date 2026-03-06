import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";
import {
  searchProducts,
  getProductDetail,
  getShippingInfo,
  calculateSellingPrice,
} from "../../services/aliexpress";

const router = Router();
router.use(authenticate, requireAdmin);

// ── Search AliExpress products ──

// GET /api/admin/aliexpress/search?q=keyword&page=1
router.get("/search", async (req: AuthRequest, res: Response) => {
  try {
    const q = (req.query.q as string) || "";
    const page = parseInt(req.query.page as string) || 1;
    if (!q) return res.status(400).json({ error: "Search query is required" });

    const result = await searchProducts(q, page);
    return res.json(result);
  } catch (error: any) {
    console.error("AliExpress search error:", error.message);
    return res.status(500).json({ error: error.message || "Search failed" });
  }
});

// ── Get AliExpress product details ──

// GET /api/admin/aliexpress/product/:productId
router.get("/product/:productId", async (req: AuthRequest, res: Response) => {
  try {
    const { productId } = req.params;
    const [detail, shipping] = await Promise.all([
      getProductDetail(productId),
      getShippingInfo(productId),
    ]);
    return res.json({ ...detail, shippingOptions: shipping.length ? shipping : detail.shippingOptions });
  } catch (error: any) {
    console.error("AliExpress product detail error:", error.message);
    return res.status(500).json({ error: error.message || "Failed to get product details" });
  }
});

// ── Import AliExpress product into shop ──

const ImportSchema = z.object({
  aliexpressProductId: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  markupType: z.enum(["PERCENTAGE", "FIXED"]),
  markupValue: z.number().positive(),
  tags: z.array(z.string()).optional(),
});

// POST /api/admin/aliexpress/import
router.post("/import", async (req: AuthRequest, res: Response) => {
  try {
    const body = ImportSchema.parse(req.body);
    const detail = await getProductDetail(body.aliexpressProductId);

    const sellingPrice = calculateSellingPrice(detail.price, body.markupType, body.markupValue);
    const slug = (body.name || detail.title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 80) + `-${Date.now().toString(36)}`;

    const product = await prisma.product.create({
      data: {
        name: body.name || detail.title,
        slug,
        description: body.description || detail.description,
        price: sellingPrice,
        comparePrice: detail.originalPrice > detail.price ? calculateSellingPrice(detail.originalPrice, body.markupType, body.markupValue) : null,
        currency: "USD",
        aliexpressProductId: body.aliexpressProductId,
        aliexpressUrl: detail.productUrl,
        aliexpressCost: detail.price,
        markupType: body.markupType,
        markupValue: body.markupValue,
        aliexpressAutoSync: true,
        lastSyncedAt: new Date(),
        stock: detail.variants.reduce((sum, v) => sum + v.stock, 0) || 100,
        trackInventory: false, // AliExpress manages stock
        allowBackorder: true,
        categoryId: body.categoryId || null,
        tags: body.tags || [],
        status: "DRAFT",
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
                name: v.skuAttr || "Default",
                price: calculateSellingPrice(v.price, body.markupType, body.markupValue),
                stock: v.stock,
                sku: `AE-${body.aliexpressProductId}-${v.skuId}`,
              })),
            }
          : undefined,
      },
      include: { images: true, variants: true },
    });

    return res.json({ message: "Product imported successfully", product });
  } catch (error: any) {
    console.error("AliExpress import error:", error.message);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    return res.status(500).json({ error: error.message || "Import failed" });
  }
});

// ── Update markup for a product ──

const MarkupSchema = z.object({
  markupType: z.enum(["PERCENTAGE", "FIXED"]),
  markupValue: z.number().positive(),
});

// PUT /api/admin/aliexpress/products/:id/markup
router.put("/products/:id/markup", async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const body = MarkupSchema.parse(req.body);

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product || !product.aliexpressProductId) {
      return res.status(404).json({ error: "AliExpress product not found" });
    }

    const newPrice = calculateSellingPrice(Number(product.aliexpressCost), body.markupType, body.markupValue);

    const updated = await prisma.product.update({
      where: { id },
      data: {
        markupType: body.markupType,
        markupValue: body.markupValue,
        price: newPrice,
      },
    });

    return res.json({ message: "Markup updated", product: updated });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    return res.status(500).json({ error: error.message || "Update failed" });
  }
});

// ── List all AliExpress-sourced products ──

// GET /api/admin/aliexpress/products
router.get("/products", async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: { aliexpressProductId: { not: null } },
        include: { images: { take: 1, orderBy: { position: "asc" } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.product.count({ where: { aliexpressProductId: { not: null } } }),
    ]);

    return res.json({ products, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to list products" });
  }
});

// ── Manual sync prices and stock for AliExpress products ──

// POST /api/admin/aliexpress/sync
router.post("/sync", async (req: AuthRequest, res: Response) => {
  try {
    const productId = req.body.productId; // optional: sync single product
    const where: any = { aliexpressProductId: { not: null }, aliexpressAutoSync: true };
    if (productId) where.id = productId;

    const products = await prisma.product.findMany({ where, take: 50 });
    const results: Array<{ id: string; name: string; status: string; changes?: any }> = [];

    for (const product of products) {
      try {
        const detail = await getProductDetail(product.aliexpressProductId!);
        const oldCost = Number(product.aliexpressCost);
        const newCost = detail.price;
        const changes: any = {};

        if (Math.abs(oldCost - newCost) > 0.01) {
          changes.price = { old: oldCost, new: newCost };
        }

        const newSellingPrice = calculateSellingPrice(
          newCost,
          product.markupType as "PERCENTAGE" | "FIXED",
          Number(product.markupValue),
        );

        const newStock = detail.variants.reduce((sum, v) => sum + v.stock, 0) || 100;
        if (product.stock !== newStock) {
          changes.stock = { old: product.stock, new: newStock };
        }

        await prisma.product.update({
          where: { id: product.id },
          data: {
            aliexpressCost: newCost,
            price: newSellingPrice,
            stock: newStock,
            lastSyncedAt: new Date(),
          },
        });

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

// ── List AliExpress order statuses ──

// GET /api/admin/aliexpress/orders
router.get("/orders", async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const status = req.query.status as string;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.aliExpressOrder.findMany({
        where,
        include: {
          order: { select: { orderNumber: true, customerName: true, customerEmail: true, totalAmount: true, currency: true } },
          product: { select: { name: true, images: { take: 1 } } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.aliExpressOrder.count({ where }),
    ]);

    return res.json({ orders, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to list orders" });
  }
});

// ── Save AliExpress API settings ──

const SettingsSchema = z.object({
  appKey: z.string().min(1),
  appSecret: z.string().min(1),
  accessToken: z.string().min(1),
});

// PUT /api/admin/aliexpress/settings
router.put("/settings", async (req: AuthRequest, res: Response) => {
  try {
    const body = SettingsSchema.parse(req.body);

    const keys = [
      { key: "ae_app_key", value: body.appKey },
      { key: "ae_app_secret", value: body.appSecret },
      { key: "ae_access_token", value: body.accessToken },
    ];

    for (const { key, value } of keys) {
      await prisma.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }

    return res.json({ message: "AliExpress settings saved" });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    return res.status(500).json({ error: error.message || "Failed to save settings" });
  }
});

// GET /api/admin/aliexpress/settings
router.get("/settings", async (req: AuthRequest, res: Response) => {
  try {
    const settings = await prisma.setting.findMany({
      where: { key: { in: ["ae_app_key", "ae_app_secret", "ae_access_token"] } },
    });

    const result: any = {};
    for (const s of settings) {
      // Mask secrets
      if (s.key === "ae_app_secret" || s.key === "ae_access_token") {
        result[s.key] = s.value ? `${s.value.substring(0, 6)}...${s.value.slice(-4)}` : "";
      } else {
        result[s.key] = s.value;
      }
    }

    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to get settings" });
  }
});

export default router;
