import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

// GET /api/categories
router.get("/", async (_req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        _count: { select: { products: true } },
      },
      orderBy: { name: "asc" },
    });

    return res.json({
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        imageUrl: c.imageUrl,
        productCount: c._count.products,
      })),
    });
  } catch (error) {
    console.error("Get categories error:", error);
    return res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// GET /api/categories/:slug
router.get("/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const category = await prisma.category.findUnique({
      where: { slug },
      include: {
        _count: { select: { products: true } },
      },
    });

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    return res.json({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      imageUrl: category.imageUrl,
      productCount: category._count.products,
    });
  } catch (error) {
    console.error("Get category error:", error);
    return res.status(500).json({ error: "Failed to fetch category" });
  }
});

export default router;
