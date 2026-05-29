import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate, optionalAuth, AuthRequest, requireAdmin } from "../middleware/auth";
import { uploadMultiple, validateUploadedFiles } from "../middleware/upload";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const router = Router();
const REVIEW_UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";

// GET /api/reviews/product/:productId
router.get("/product/:productId", async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { page = "1", limit = "10", sort = "newest" } = req.query;

    const take = Math.min(parseInt(limit as string) || 10, 50);
    const skip = (Math.max(parseInt(page as string) || 1, 1) - 1) * take;

    let orderBy: any = { createdAt: "desc" };
    if (sort === "rating_high") orderBy = { rating: "desc" };
    if (sort === "rating_low") orderBy = { rating: "asc" };
    if (sort === "oldest") orderBy = { createdAt: "asc" };

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { productId, approved: true },
        orderBy,
        take,
        skip,
        include: {
          images: true,
          user: { select: { name: true } },
        },
      }),
      prisma.review.count({ where: { productId, approved: true } }),
    ]);

    // Calculate rating distribution
    const ratingDist = await prisma.review.groupBy({
      by: ["rating"],
      where: { productId, approved: true },
      _count: { rating: true },
    });

    const distribution = [5, 4, 3, 2, 1].map((r) => ({
      rating: r,
      count: ratingDist.find((d) => d.rating === r)?._count.rating || 0,
    }));

    return res.json({
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        content: r.content,
        verified: r.verified,
        // Anonymous by default — show "Verified Buyer in [City]" instead of real name
        author: r.isAnonymous
          ? (r.displayCity ? `Verified Buyer in ${r.displayCity}` : "Verified Buyer")
          : (r.user.name || "Customer"),
        avatarUrl: r.isAnonymous ? null : undefined,
        isAnonymous: r.isAnonymous,
        images: r.images.map((img) => ({ id: img.id, url: img.url, position: img.position })),
        createdAt: r.createdAt,
      })),
      distribution,
      pagination: {
        total,
        page: Math.floor(skip / take) + 1,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error("Get reviews error:", error);
    return res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// POST /api/reviews
router.post("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      productId: z.string(),
      rating: z.number().int().min(1).max(5),
      title: z.string().max(100).optional(),
      content: z.string().max(2000).optional(),
      isAnonymous: z.boolean().default(true),
      images: z.array(z.string().url()).max(3).optional(),
    });

    const body = schema.parse(req.body);

    // Check if product exists
    const product = await prisma.product.findUnique({ where: { id: body.productId } });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Check if user already reviewed this product
    const existing = await prisma.review.findUnique({
      where: { productId_userId: { productId: body.productId, userId: req.user!.id } },
    });
    if (existing) {
      return res.status(400).json({ error: "You have already reviewed this product" });
    }

    // Check if user purchased this product (for verified badge)
    const hasPurchased = await prisma.orderItem.findFirst({
      where: {
        productId: body.productId,
        order: { userId: req.user!.id, status: "DELIVERED" },
      },
    });

    // Get display city from latest delivered order address
    let displayCity: string | null = null;
    if (body.isAnonymous && hasPurchased) {
      const order = await prisma.order.findFirst({
        where: { userId: req.user!.id, status: { in: ["DELIVERED"] } },
        orderBy: { createdAt: "desc" },
      });
      if (order?.shippingAddress) {
        try { displayCity = JSON.parse(order.shippingAddress)?.city || null; } catch {}
      }
    }

    const review = await prisma.review.create({
      data: {
        productId: body.productId,
        userId: req.user!.id,
        rating: body.rating,
        title: body.title,
        content: body.content,
        verified: !!hasPurchased,
        approved: true,
        isAnonymous: body.isAnonymous,
        displayCity,
      },
    });

    // Create review images if provided
    if (body.images && body.images.length > 0) {
      await prisma.reviewImage.createMany({
        data: body.images.map((url, index) => ({
          reviewId: review.id,
          userId: req.user!.id,
          url,
          position: index,
        })),
      });
    }

    // Update product rating
    const avgRating = await prisma.review.aggregate({
      where: { productId: body.productId, approved: true },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await prisma.product.update({
      where: { id: body.productId },
      data: {
        rating: avgRating._avg.rating || 0,
        reviewCount: avgRating._count.rating,
      },
    });

    return res.status(201).json({
      message: "Review submitted",
      review: {
        id: review.id,
        rating: review.rating,
        verified: review.verified,
      },
    });
  } catch (error) {
    console.error("Create review error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    return res.status(500).json({ error: "Failed to submit review" });
  }
});

// POST /api/reviews/upload-image — Upload review images (authenticated)
router.post("/upload-image", authenticate, uploadMultiple, validateUploadedFiles, async (req: AuthRequest, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No images uploaded" });
    }
    if (files.length > 3) {
      return res.status(400).json({ error: "Maximum 3 images allowed" });
    }

    const blur = req.query.blur === "true";
    const urls: string[] = [];

    for (const file of files) {
      if (blur) {
        // Apply privacy blur and re-save
        const blurred = await sharp(path.join(REVIEW_UPLOAD_DIR, file.filename))
          .blur(10)
          .jpeg({ quality: 80 })
          .toBuffer();

        const blurredFilename = `blur-${uuidv4()}.jpg`;
        await fs.promises.writeFile(path.join(REVIEW_UPLOAD_DIR, blurredFilename), blurred);
        urls.push(`/uploads/${blurredFilename}`);
      } else {
        urls.push(`/uploads/${file.filename}`);
      }
    }

    return res.status(201).json({ urls });
  } catch (error) {
    console.error("Review image upload error:", error);
    return res.status(500).json({ error: "Failed to upload images" });
  }
});

// GET /api/reviews/admin/all — List all reviews (admin)
router.get("/admin/all", authenticate, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const reviews = await prisma.review.findMany({
      include: {
        product: { select: { name: true, slug: true, images: { take: 1, select: { url: true } } } },
        user: { select: { name: true, email: true } },
        images: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(reviews);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/reviews/:id
router.put("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      rating: z.number().int().min(1).max(5).optional(),
      title: z.string().max(100).optional(),
      content: z.string().max(2000).optional(),
    });

    const body = schema.parse(req.body);

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }
    if (review.userId !== req.user!.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const updated = await prisma.review.update({
      where: { id },
      data: body,
    });

    // Recalculate product rating if rating changed
    if (body.rating) {
      const avgRating = await prisma.review.aggregate({
        where: { productId: review.productId, approved: true },
        _avg: { rating: true },
      });

      await prisma.product.update({
        where: { id: review.productId },
        data: { rating: avgRating._avg.rating || 0 },
      });
    }

    return res.json({ message: "Review updated", review: updated });
  } catch (error) {
    console.error("Update review error:", error);
    return res.status(500).json({ error: "Failed to update review" });
  }
});

// DELETE /api/reviews/:id
router.delete("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }
    if (review.userId !== req.user!.id && req.user!.role !== "ADMIN") {
      return res.status(403).json({ error: "Not authorized" });
    }

    await prisma.review.delete({ where: { id } });

    // Recalculate product rating
    const avgRating = await prisma.review.aggregate({
      where: { productId: review.productId, approved: true },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await prisma.product.update({
      where: { id: review.productId },
      data: {
        rating: avgRating._avg.rating || 0,
        reviewCount: avgRating._count.rating,
      },
    });

    return res.json({ message: "Review deleted" });
  } catch (error) {
    console.error("Delete review error:", error);
    return res.status(500).json({ error: "Failed to delete review" });
  }
});

export default router;
