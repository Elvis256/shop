import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest, requireAdmin } from "../middleware/auth";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

// GET /api/bundles — List active bundles with their products
router.get("/", asyncHandler(async (_req: Request, res: Response) => {
  try {
    const bundles = await prisma.productBundle.findMany({
      where: { isActive: true },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                price: true,
                currency: true,
                images: { take: 1, orderBy: { position: "asc" } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json(
      bundles.map((b) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        description: b.description,
        discount: b.discount,
        items: b.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          product: {
            ...item.product,
            imageUrl: item.product.images[0]?.url || null,
          },
        })),
      }))
    );
  } catch (error) {
    logger.error("List bundles error", { error });
    return res.status(500).json({ error: "Failed to fetch bundles" });
  }
}));

// GET /api/bundles/for-product/:productId — Get bundles containing this product
router.get(
  "/for-product/:productId",
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { productId } = req.params;

      const bundles = await prisma.productBundle.findMany({
        where: {
          isActive: true,
          items: { some: { productId } },
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  price: true,
                  currency: true,
                  images: { take: 1, orderBy: { position: "asc" } },
                },
              },
            },
          },
        },
      });

      return res.json(
        bundles.map((b) => {
          const totalPrice = b.items.reduce(
            (sum, item) =>
              sum + Number(item.product.price) * item.quantity,
            0
          );
          const discountedPrice =
            totalPrice * (1 - Number(b.discount) / 100);

          return {
            id: b.id,
            name: b.name,
            slug: b.slug,
            description: b.description,
            discount: b.discount,
            totalPrice,
            discountedPrice,
            items: b.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              product: {
                ...item.product,
                imageUrl: item.product.images[0]?.url || null,
              },
            })),
          };
        })
      );
    } catch (error) {
      logger.error("Get bundles for product error", { error });
      return res.status(500).json({ error: "Failed to fetch bundles" });
    }
  }
));

// GET /api/bundles/:slug — Get bundle detail with products and calculated prices
router.get("/:slug", asyncHandler(async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const bundle = await prisma.productBundle.findUnique({
      where: { slug },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                price: true,
                comparePrice: true,
                currency: true,
                stock: true,
                images: { take: 1, orderBy: { position: "asc" } },
              },
            },
          },
        },
      },
    });

    if (!bundle) {
      return res.status(404).json({ error: "Bundle not found" });
    }

    const totalPrice = bundle.items.reduce(
      (sum, item) => sum + Number(item.product.price) * item.quantity,
      0
    );
    const discountedPrice =
      totalPrice * (1 - Number(bundle.discount) / 100);

    return res.json({
      id: bundle.id,
      name: bundle.name,
      slug: bundle.slug,
      description: bundle.description,
      discount: bundle.discount,
      isActive: bundle.isActive,
      totalPrice,
      discountedPrice,
      savings: totalPrice - discountedPrice,
      items: bundle.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        product: {
          ...item.product,
          imageUrl: item.product.images[0]?.url || null,
          inStock: item.product.stock > 0,
        },
      })),
    });
  } catch (error) {
    logger.error("Get bundle error", { error });
    return res.status(500).json({ error: "Failed to fetch bundle" });
  }
}));

// POST /api/bundles/calculate-custom — Calculate custom bundle pricing with tier discounts
router.post("/calculate-custom", asyncHandler(async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      items: z.array(z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
      })).min(1),
    });

    const body = schema.parse(req.body);

    const productIds = body.items.map(i => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, status: "ACTIVE" },
      select: {
        id: true, name: true, slug: true, price: true, currency: true, stock: true,
        images: { take: 1, orderBy: { position: "asc" } },
      },
    });

    const productMap = new Map(products.map(p => [p.id, p]));

    const resolvedItems = body.items
      .filter(i => productMap.has(i.productId))
      .map(i => {
        const p = productMap.get(i.productId)!;
        return {
          productId: p.id,
          name: p.name,
          slug: p.slug,
          price: Number(p.price),
          quantity: i.quantity,
          lineTotal: Number(p.price) * i.quantity,
          imageUrl: p.images[0]?.url || null,
          inStock: p.stock >= i.quantity,
        };
      });

    const totalItems = resolvedItems.reduce((sum, i) => sum + i.quantity, 0);
    const subtotal = resolvedItems.reduce((sum, i) => sum + i.lineTotal, 0);

    // Discount tiers
    let discountPercent = 0;
    let tier = "";
    if (totalItems >= 7) {
      discountPercent = 20;
      tier = "7+ items: 20% off";
    } else if (totalItems >= 5) {
      discountPercent = 15;
      tier = "5+ items: 15% off";
    } else if (totalItems >= 3) {
      discountPercent = 10;
      tier = "3+ items: 10% off";
    }

    const discountAmount = Math.round(subtotal * discountPercent / 100);
    const total = subtotal - discountAmount;

    return res.json({
      items: resolvedItems,
      subtotal,
      discountPercent,
      discountAmount,
      total,
      tier,
      totalItems,
    });
  } catch (error) {
    logger.error("Calculate custom bundle error", { error });
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    return res.status(500).json({ error: "Failed to calculate bundle" });
  }
}));

// ─── Admin Routes ────────────────────────────────────────────────────────────

// POST /api/bundles — Create bundle
router.post(
  "/",
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const schema = z.object({
        name: z.string().min(1).max(200),
        slug: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        discount: z.number().min(0).max(100),
        isActive: z.boolean().optional().default(true),
        items: z.array(
          z.object({
            productId: z.string(),
            quantity: z.number().int().positive().default(1),
          })
        ).min(1),
      });

      const body = schema.parse(req.body);

      const bundle = await prisma.productBundle.create({
        data: {
          name: body.name,
          slug: body.slug,
          description: body.description,
          discount: body.discount,
          isActive: body.isActive,
          items: {
            create: body.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
          },
        },
        include: { items: true },
      });

      return res.status(201).json({ message: "Bundle created", bundle });
    } catch (error) {
      logger.error("Create bundle error", { error });
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      return res.status(500).json({ error: "Failed to create bundle" });
    }
  }
));

// PUT /api/bundles/:id — Update bundle
router.put(
  "/:id",
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const schema = z.object({
        name: z.string().min(1).max(200).optional(),
        slug: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).optional(),
        discount: z.number().min(0).max(100).optional(),
        isActive: z.boolean().optional(),
        items: z
          .array(
            z.object({
              productId: z.string(),
              quantity: z.number().int().positive().default(1),
            })
          )
          .min(1)
          .optional(),
      });

      const body = schema.parse(req.body);

      const existing = await prisma.productBundle.findUnique({
        where: { id },
      });
      if (!existing) {
        return res.status(404).json({ error: "Bundle not found" });
      }

      const { items, ...updateData } = body;

      const bundle = await prisma.$transaction(async (tx) => {
        if (items) {
          await tx.bundleItem.deleteMany({ where: { bundleId: id } });
          await tx.bundleItem.createMany({
            data: items.map((item) => ({
              bundleId: id,
              productId: item.productId,
              quantity: item.quantity,
            })),
          });
        }

        return tx.productBundle.update({
          where: { id },
          data: updateData,
          include: { items: true },
        });
      });

      return res.json({ message: "Bundle updated", bundle });
    } catch (error) {
      logger.error("Update bundle error", { error });
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      return res.status(500).json({ error: "Failed to update bundle" });
    }
  }
));

// DELETE /api/bundles/:id — Delete bundle
router.delete(
  "/:id",
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const existing = await prisma.productBundle.findUnique({
        where: { id },
      });
      if (!existing) {
        return res.status(404).json({ error: "Bundle not found" });
      }

      await prisma.productBundle.delete({ where: { id } });

      return res.json({ message: "Bundle deleted" });
    } catch (error) {
      logger.error("Delete bundle error", { error });
      return res.status(500).json({ error: "Failed to delete bundle" });
    }
  }
));

export default router;
