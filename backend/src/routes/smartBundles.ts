import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { cacheGetOrSet, SHORT_TTL } from "../lib/cache";

const router = Router();

// GET /api/smart-bundles/:productId/frequently-bought-together
// Returns top products frequently ordered alongside this product
router.get("/:productId/frequently-bought-together", async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 3, 6);

    const cacheKey = `fbt:${productId}:${limit}`;

    const result = await cacheGetOrSet(cacheKey, async () => {
      // Find all orders containing this product
      const orderIds = await prisma.orderItem.findMany({
        where: { productId },
        select: { orderId: true },
        distinct: ["orderId"],
        take: 500, // Cap for performance
      });

      if (orderIds.length === 0) return [];

      // Find other products in those same orders
      const coProducts = await prisma.orderItem.groupBy({
        by: ["productId"],
        where: {
          orderId: { in: orderIds.map((o) => o.orderId) },
          productId: { not: productId }, // Exclude the source product
        },
        _count: { productId: true },
        orderBy: { _count: { productId: "desc" } },
        take: limit,
      });

      if (coProducts.length === 0) return [];

      const products = await prisma.product.findMany({
        where: {
          id: { in: coProducts.map((p) => p.productId) },
          status: "ACTIVE",
        },
        include: {
          images: { take: 1, orderBy: { position: "asc" } },
          category: { select: { name: true } },
        },
      });

      return coProducts
        .map((cp) => {
          const product = products.find((p) => p.id === cp.productId);
          if (!product) return null;
          return {
            id: product.id,
            name: product.name,
            slug: product.slug,
            price: Number(product.price),
            comparePrice: product.comparePrice ? Number(product.comparePrice) : null,
            imageUrl: product.images[0]?.url || null,
            category: product.category?.name || null,
            coOrderCount: cp._count.productId,
          };
        })
        .filter(Boolean);
    }, SHORT_TTL);

    // Calculate bundle discount suggestion (10% off when buying together)
    const bundleDiscount = result.length > 0 ? 10 : 0;

    return res.json({
      products: result,
      bundleDiscount,
      message: result.length > 0
        ? `Customers also bought these — save ${bundleDiscount}% when adding all to cart`
        : null,
    });
  } catch (error) {
    console.error("Frequently bought together error:", error);
    return res.status(500).json({ error: "Failed to load recommendations" });
  }
});

// GET /api/smart-bundles/trending — Most co-purchased product pairs overall
router.get("/trending", async (_req: Request, res: Response) => {
  try {
    const data = await cacheGetOrSet("fbt:trending", async () => {
      const topProducts = await prisma.orderItem.groupBy({
        by: ["productId"],
        _count: { productId: true },
        orderBy: { _count: { productId: "desc" } },
        take: 8,
      });

      const products = await prisma.product.findMany({
        where: {
          id: { in: topProducts.map((p) => p.productId) },
          status: "ACTIVE",
        },
        include: {
          images: { take: 1, orderBy: { position: "asc" } },
        },
      });

      return products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: Number(p.price),
        imageUrl: p.images[0]?.url || null,
        orderCount: topProducts.find((tp) => tp.productId === p.id)?._count.productId || 0,
      }));
    }, SHORT_TTL);

    return res.json({ products: data });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load trending products" });
  }
});

export default router;
