import { Router, Response } from "express";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";
import { logActivity } from "../../lib/activityLogger";
import { logger } from "../../lib/logger";
import { asyncHandler } from "../../middleware/errorHandler";
import { sendEmail } from "../../lib/email";

const router = Router();

router.use(authenticate, requireAdmin);

// GET / — List PENDING_REVIEW products
router.get("/", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const search = req.query.search as string;
    const status = (req.query.status as string) || "PENDING_REVIEW";

    const where: any = { status };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { seller: { storeName: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          images: { take: 3 },
          category: { select: { id: true, name: true } },
          seller: { select: { id: true, storeName: true, email: true, logo: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    const pendingCount = status === "PENDING_REVIEW"
      ? total
      : await prisma.product.count({ where: { status: "PENDING_REVIEW" } });

    return res.json({
      products,
      pendingCount,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error("Product moderation list error", { error });
    return res.status(500).json({ error: "Failed to load products for review" });
  }
}));

// PUT /:id/approve — Approve product
router.put("/:id/approve", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, sellerId: true, status: true, seller: { select: { email: true, storeName: true } } },
    });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        status: "ACTIVE",
        moderationNote: null,
        moderatedBy: req.user!.id,
      },
    });

    if (product.sellerId) {
      logActivity({
        userId: req.user!.id,
        action: "PRODUCT_APPROVED",
        entityType: "Seller",
        entityId: product.sellerId,
        description: `Approved product "${product.name}"`,
      });

      // Notify seller
      if (product.seller?.email) {
        sendEmail({
          to: product.seller.email,
          template: "seller-product-approved" as any,
          data: { productName: product.name, storeName: product.seller.storeName },
        }).catch((e: any) => logger.warn("Failed to notify seller of approval", { error: e.message }));
      }
    }

    return res.json({ product: updated });
  } catch (error) {
    logger.error("Product approve error", { error });
    return res.status(500).json({ error: "Failed to approve product" });
  }
}));

// PUT /:id/reject — Reject product (back to DRAFT)
router.put("/:id/reject", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body;
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, sellerId: true, status: true, seller: { select: { email: true, storeName: true } } },
    });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        status: "DRAFT",
        moderationNote: reason?.trim() || null,
        moderatedBy: req.user!.id,
      },
    });

    if (product.sellerId) {
      logActivity({
        userId: req.user!.id,
        action: "PRODUCT_REJECTED",
        entityType: "Seller",
        entityId: product.sellerId,
        description: `Rejected product "${product.name}"${reason ? `: ${reason}` : ""}`,
      });

      // Notify seller
      if (product.seller?.email) {
        sendEmail({
          to: product.seller.email,
          template: "seller-product-rejected" as any,
          data: { productName: product.name, storeName: product.seller.storeName, reason: reason?.trim() || "No reason provided" },
        }).catch((e: any) => logger.warn("Failed to notify seller of rejection", { error: e.message }));
      }
    }

    return res.json({ product: updated });
  } catch (error) {
    logger.error("Product reject error", { error });
    return res.status(500).json({ error: "Failed to reject product" });
  }
}));

// PUT /:id/request-changes — Keep PENDING_REVIEW, add note
router.put("/:id/request-changes", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body;
    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({ error: "Reason is required for change requests" });
    }

    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, sellerId: true, status: true, seller: { select: { email: true, storeName: true } } },
    });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        moderationNote: reason.trim(),
        moderatedBy: req.user!.id,
      },
    });

    if (product.sellerId) {
      logActivity({
        userId: req.user!.id,
        action: "PRODUCT_CHANGES_REQUESTED",
        entityType: "Seller",
        entityId: product.sellerId,
        description: `Requested changes on product "${product.name}": ${reason.trim()}`,
      });

      // Notify seller
      if (product.seller?.email) {
        sendEmail({
          to: product.seller.email,
          template: "seller-product-changes" as any,
          data: { productName: product.name, storeName: product.seller.storeName, reason: reason.trim() },
        }).catch((e: any) => logger.warn("Failed to notify seller of change request", { error: e.message }));
      }
    }

    return res.json({ product: updated });
  } catch (error) {
    logger.error("Product request changes error", { error });
    return res.status(500).json({ error: "Failed to request changes" });
  }
}));

export default router;
