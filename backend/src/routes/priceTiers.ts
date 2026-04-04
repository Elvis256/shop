import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest, requireAdmin } from "../middleware/auth";

const router = Router();

// GET /api/price-tiers/:productId — Get price tiers for a product
router.get("/:productId", async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;

    const tiers = await prisma.priceTier.findMany({
      where: { productId },
      orderBy: { minQty: "asc" },
    });

    return res.json({ productId, tiers });
  } catch (error) {
    console.error("Get price tiers error:", error);
    return res.status(500).json({ error: "Failed to fetch price tiers" });
  }
});

// POST /api/price-tiers — Create/update tiers for a product (admin)
router.post(
  "/",
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const schema = z.object({
        productId: z.string(),
        tiers: z.array(
          z.object({
            minQty: z.number().int().positive(),
            discount: z.number().min(0).max(100),
            label: z.string().max(200).optional(),
          })
        ),
      });

      const body = schema.parse(req.body);

      // Verify product exists
      const product = await prisma.product.findUnique({
        where: { id: body.productId },
      });
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      // Replace all tiers for this product
      await prisma.$transaction(async (tx) => {
        await tx.priceTier.deleteMany({
          where: { productId: body.productId },
        });

        if (body.tiers.length > 0) {
          await tx.priceTier.createMany({
            data: body.tiers.map((tier) => ({
              productId: body.productId,
              minQty: tier.minQty,
              discount: tier.discount,
              label: tier.label,
            })),
          });
        }
      });

      const tiers = await prisma.priceTier.findMany({
        where: { productId: body.productId },
        orderBy: { minQty: "asc" },
      });

      return res.json({ message: "Price tiers updated", tiers });
    } catch (error) {
      console.error("Create/update price tiers error:", error);
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Validation failed", details: error.errors });
      }
      return res.status(500).json({ error: "Failed to update price tiers" });
    }
  }
);

// DELETE /api/price-tiers/:productId — Remove all tiers for a product (admin)
router.delete(
  "/:productId",
  authenticate,
  requireAdmin,
  async (req: AuthRequest, res: Response) => {
    try {
      const { productId } = req.params;

      await prisma.priceTier.deleteMany({ where: { productId } });

      return res.json({ message: "Price tiers removed" });
    } catch (error) {
      console.error("Delete price tiers error:", error);
      return res.status(500).json({ error: "Failed to delete price tiers" });
    }
  }
);

export default router;
