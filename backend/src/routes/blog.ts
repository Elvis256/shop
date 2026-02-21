import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";

const router = Router();

// GET /api/blog - List published posts
router.get("/", async (req: Request, res: Response) => {
  try {
    const { category, tag, featured, limit = "10", page = "1" } = req.query;

    const take = Math.min(parseInt(limit as string, 10) || 10, 50);
    const skip = (Math.max(parseInt(page as string, 10) || 1, 1) - 1) * take;

    const where: any = {
      status: "PUBLISHED",
    };

    if (category) {
      where.category = category;
    }

    if (tag) {
      where.tags = { has: tag };
    }

    if (featured === "true") {
      where.featured = true;
    }

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        take,
        skip,
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          featuredImage: true,
          author: true,
          category: true,
          tags: true,
          featured: true,
          publishedAt: true,
        },
      }),
      prisma.blogPost.count({ where }),
    ]);

    return res.json({
      posts,
      pagination: {
        total,
        page: Math.floor(skip / take) + 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error("Get blog posts error:", error);
    return res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// GET /api/blog/categories - List all categories
router.get("/categories", async (_req: Request, res: Response) => {
  try {
    const categories = await prisma.blogPost.groupBy({
      by: ["category"],
      where: { status: "PUBLISHED", category: { not: null } },
      _count: true,
    });

    return res.json(
      categories
        .filter((c) => c.category)
        .map((c) => ({
          name: c.category,
          count: c._count,
        }))
    );
  } catch (error) {
    console.error("Get blog categories error:", error);
    return res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// GET /api/blog/:slug - Get single post
router.get("/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const post = await prisma.blogPost.findUnique({
      where: { slug },
    });

    if (!post || post.status !== "PUBLISHED") {
      return res.status(404).json({ error: "Post not found" });
    }

    // Get related posts
    const relatedPosts = await prisma.blogPost.findMany({
      where: {
        id: { not: post.id },
        status: "PUBLISHED",
        OR: [
          { category: post.category },
          { tags: { hasSome: post.tags } },
        ],
      },
      orderBy: { publishedAt: "desc" },
      take: 3,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        featuredImage: true,
        publishedAt: true,
      },
    });

    return res.json({
      ...post,
      relatedPosts,
    });
  } catch (error) {
    console.error("Get blog post error:", error);
    return res.status(500).json({ error: "Failed to fetch post" });
  }
});

export default router;
