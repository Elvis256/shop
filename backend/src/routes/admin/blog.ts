import { Router, Response } from "express";
import { z } from "zod";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";

const router = Router();
router.use(authenticate, requireAdmin);

// GET /api/admin/blog - List all posts (including drafts)
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { status, page = "1", limit = "20" } = req.query;
    const take = Math.min(parseInt(limit as string, 10) || 20, 100);
    const skip = (Math.max(parseInt(page as string, 10) || 1, 1) - 1) * take;
    const where: any = {};
    if (status) where.status = status;

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({ where, orderBy: { createdAt: "desc" }, take, skip }),
      prisma.blogPost.count({ where }),
    ]);

    return res.json({ posts, total, page: parseInt(page as string), totalPages: Math.ceil(total / take) });
  } catch (error) {
    console.error("Admin list blog error:", error);
    return res.status(500).json({ error: "Failed to fetch posts" });
  }
});

const postSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).optional(),
  excerpt: z.string().optional(),
  content: z.string().min(1),
  featuredImage: z.string().optional(),
  author: z.string().optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  featured: z.boolean().optional(),
  publishedAt: z.string().optional(),
});

// POST /api/admin/blog - Create post
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const data = postSchema.parse(req.body);
    const slug = data.slug || data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const post = await prisma.blogPost.create({
      data: {
        ...data,
        slug,
        publishedAt: data.status === "PUBLISHED" ? (data.publishedAt ? new Date(data.publishedAt) : new Date()) : null,
        tags: data.tags || [],
      },
    });

    return res.status(201).json({ post });
  } catch (error: any) {
    if (error?.code === "P2002") return res.status(409).json({ error: "Slug already exists" });
    console.error("Admin create blog error:", error);
    return res.status(400).json({ error: error?.message || "Failed to create post" });
  }
});

// GET /api/admin/blog/:id - Get single post
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const post = await prisma.blogPost.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: "Post not found" });
    return res.json({ post });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch post" });
  }
});

// PUT /api/admin/blog/:id - Update post
router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const data = postSchema.partial().parse(req.body);
    const existing = await prisma.blogPost.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Post not found" });

    const publishedAt =
      data.status === "PUBLISHED" && !existing.publishedAt
        ? new Date()
        : data.publishedAt
        ? new Date(data.publishedAt)
        : existing.publishedAt;

    const post = await prisma.blogPost.update({
      where: { id: req.params.id },
      data: { ...data, publishedAt },
    });

    return res.json({ post });
  } catch (error: any) {
    if (error?.code === "P2002") return res.status(409).json({ error: "Slug already exists" });
    console.error("Admin update blog error:", error);
    return res.status(400).json({ error: error?.message || "Failed to update post" });
  }
});

// DELETE /api/admin/blog/:id - Delete post
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    await prisma.blogPost.delete({ where: { id: req.params.id } });
    return res.json({ message: "Post deleted" });
  } catch (error) {
    return res.status(500).json({ error: "Failed to delete post" });
  }
});

export default router;
