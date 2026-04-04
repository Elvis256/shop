import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";

const router = Router();

router.use(authenticate, requireAdmin);

// GET /api/admin/settings
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const settings = await prisma.setting.findMany();
    
    const settingsMap = settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {} as Record<string, string>);

    return res.json({ settings: settingsMap });
  } catch (error) {
    console.error("Admin get settings error:", error);
    return res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// PUT /api/admin/settings
router.put("/", async (req: AuthRequest, res: Response) => {
  try {
    const settings = z.record(z.string()).parse(req.body);

    // Update each setting
    for (const [key, value] of Object.entries(settings)) {
      await prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }

    return res.json({ message: "Settings updated" });
  } catch (error) {
    console.error("Admin update settings error:", error);
    return res.status(500).json({ error: "Failed to update settings" });
  }
});

// POST /api/admin/settings/apply-processing-fee
// Adjusts all product prices from oldFee% to newFee%
router.post("/apply-processing-fee", async (req: AuthRequest, res: Response) => {
  try {
    const { oldFee, newFee } = z.object({
      oldFee: z.number().min(0).max(50),
      newFee: z.number().min(0).max(50),
    }).parse(req.body);

    // multiplier = (1 + newFee/100) / (1 + oldFee/100)
    const multiplier = (1 + newFee / 100) / (1 + oldFee / 100);

    // Update all prices using raw SQL (Prisma Decimal workaround)
    const products = await prisma.$executeRaw`UPDATE "Product" SET price = CEIL(price * ${multiplier})`;
    const comparePrices = await prisma.$executeRaw`UPDATE "Product" SET "comparePrice" = CEIL("comparePrice" * ${multiplier}) WHERE "comparePrice" IS NOT NULL`;
    const flashPrices = await prisma.$executeRaw`UPDATE "Product" SET "flashSalePrice" = CEIL("flashSalePrice" * ${multiplier}) WHERE "flashSalePrice" IS NOT NULL`;
    const variants = await prisma.$executeRaw`UPDATE "ProductVariant" SET price = CEIL(price * ${multiplier}) WHERE price IS NOT NULL`;

    // Persist the new fee setting
    await prisma.setting.upsert({
      where: { key: "payment_processing_fee" },
      update: { value: String(newFee) },
      create: { key: "payment_processing_fee", value: String(newFee) },
    });

    return res.json({
      message: `Processing fee updated from ${oldFee}% to ${newFee}%`,
      updated: { products, comparePrices, flashPrices, variants },
    });
  } catch (error) {
    console.error("Apply processing fee error:", error);
    return res.status(500).json({ error: "Failed to apply processing fee" });
  }
});

// GET /api/admin/inventory
router.get("/inventory", async (req: AuthRequest, res: Response) => {
  try {
    const lowStockProducts = await prisma.product.findMany({
      where: {
        status: "ACTIVE",
        trackInventory: true,
        stock: { lte: prisma.product.fields.lowStockAlert },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
        lowStockAlert: true,
      },
      orderBy: { stock: "asc" },
    });

    const outOfStock = await prisma.product.findMany({
      where: { status: "ACTIVE", trackInventory: true, stock: 0 },
      select: { id: true, name: true, sku: true },
    });

    const inventoryValue = await prisma.product.aggregate({
      where: { status: "ACTIVE" },
      _sum: { stock: true },
    });

    return res.json({
      lowStock: lowStockProducts,
      outOfStock,
      totalItems: inventoryValue._sum.stock || 0,
    });
  } catch (error) {
    console.error("Admin inventory error:", error);
    return res.status(500).json({ error: "Failed to fetch inventory" });
  }
});

// PUT /api/admin/inventory/:productId
router.put("/inventory/:productId", async (req: AuthRequest, res: Response) => {
  try {
    const { productId } = req.params;
    const { stock, adjustment, reason } = z
      .object({
        stock: z.number().int().min(0).optional(),
        adjustment: z.number().int().optional(),
        reason: z.string().optional(),
      })
      .parse(req.body);

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    let newStock = product.stock;
    if (stock !== undefined) {
      newStock = stock;
    } else if (adjustment !== undefined) {
      newStock = product.stock + adjustment;
    }

    if (newStock < 0) {
      return res.status(400).json({ error: "Stock cannot be negative" });
    }

    await prisma.product.update({
      where: { id: productId },
      data: { stock: newStock },
    });

    return res.json({
      message: "Inventory updated",
      productId,
      oldStock: product.stock,
      newStock,
    });
  } catch (error) {
    console.error("Admin update inventory error:", error);
    return res.status(500).json({ error: "Failed to update inventory" });
  }
});

export default router;
