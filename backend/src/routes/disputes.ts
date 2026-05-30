import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { uploadDocuments, validateUploadedDocuments } from "../middleware/upload";

const router = Router();

router.use(authenticate);

// Generate dispute number
function generateDisputeNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `DSP-${dateStr}-${rand}`;
}

// POST /api/disputes — File a dispute on an order
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { orderId, category, reason } = req.body;

    if (!orderId || !category || !reason) {
      return res.status(400).json({ error: "orderId, category, and reason are required" });
    }

    // Verify order exists and belongs to user
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { select: { sellerId: true } },
        escrow: true,
        disputes: { where: { status: { notIn: ["CLOSED", "RESOLVED"] } } },
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.userId !== userId && order.customerEmail !== req.user!.email) {
      return res.status(403).json({ error: "You can only dispute your own orders" });
    }

    // Only allow disputes on SHIPPED or DELIVERED orders
    if (!["SHIPPED", "DELIVERED"].includes(order.status)) {
      return res.status(400).json({
        error: "Disputes can only be filed for shipped or delivered orders",
      });
    }

    // Check for existing open dispute
    if (order.disputes.length > 0) {
      return res.status(400).json({ error: "An active dispute already exists for this order" });
    }

    // Get seller ID from order items
    const sellerId = order.items.find((i) => i.sellerId)?.sellerId;
    if (!sellerId) {
      return res.status(400).json({ error: "No seller found for this order" });
    }

    // Create dispute
    const dispute = await prisma.$transaction(async (tx) => {
      const d = await tx.dispute.create({
        data: {
          disputeNumber: generateDisputeNumber(),
          orderId,
          buyerId: userId,
          sellerId,
          category,
          reason,
          status: "OPEN",
          sellerDeadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days to respond
        },
      });

      // If escrow exists, freeze it
      if (order.escrow) {
        await tx.escrowTransaction.update({
          where: { id: order.escrow.id },
          data: { status: "DISPUTED", disputeId: d.id },
        });
      }

      // Add timeline event to order
      await tx.orderEvent.create({
        data: {
          orderId,
          status: "DISPUTE_OPENED",
          note: `Dispute filed: ${category} - ${reason.substring(0, 100)}`,
        },
      });

      return d;
    });

    return res.status(201).json(dispute);
  } catch (error) {
    console.error("Create dispute error:", error);
    return res.status(500).json({ error: "Failed to create dispute" });
  }
});

// GET /api/disputes — List user's disputes
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { status } = req.query;

    const where: any = { buyerId: userId };
    if (status) where.status = status;

    const disputes = await prisma.dispute.findMany({
      where,
      include: {
        order: {
          select: {
            orderNumber: true,
            totalAmount: true,
            currency: true,
            status: true,
          },
        },
        seller: {
          select: { storeName: true, logo: true },
        },
        _count: { select: { evidence: true, messages: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json(disputes);
  } catch (error) {
    console.error("List disputes error:", error);
    return res.status(500).json({ error: "Failed to fetch disputes" });
  }
});

// GET /api/disputes/:id — Get dispute details
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const dispute = await prisma.dispute.findUnique({
      where: { id: req.params.id },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            currency: true,
            status: true,
            items: {
              include: {
                product: {
                  select: { name: true, slug: true, images: { take: 1 } },
                },
              },
            },
          },
        },
        seller: {
          select: { storeName: true, logo: true },
        },
        evidence: { orderBy: { createdAt: "desc" } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    // Only buyer, seller, or admin can view
    const isAdmin = req.user!.role === "ADMIN" || req.user!.role === "MANAGER";
    if (dispute.buyerId !== userId && dispute.sellerId !== userId && !isAdmin) {
      return res.status(403).json({ error: "Not authorized" });
    }

    return res.json(dispute);
  } catch (error) {
    console.error("Get dispute error:", error);
    return res.status(500).json({ error: "Failed to fetch dispute" });
  }
});

// POST /api/disputes/:id/evidence — Upload evidence
router.post("/:id/evidence", uploadDocuments, validateUploadedDocuments, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const dispute = await prisma.dispute.findUnique({ where: { id: req.params.id } });

    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    if (dispute.buyerId !== userId && dispute.sellerId !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const evidence = await Promise.all(
      files.map((file) =>
        prisma.disputeEvidence.create({
          data: {
            disputeId: dispute.id,
            uploadedBy: userId,
            type: file.mimetype.startsWith("image/") ? "photo" : "document",
            fileUrl: `/uploads/${file.filename}`,
            fileName: file.originalname,
            description: req.body.description || null,
          },
        })
      )
    );

    return res.status(201).json(evidence);
  } catch (error) {
    console.error("Upload evidence error:", error);
    return res.status(500).json({ error: "Failed to upload evidence" });
  }
});

// POST /api/disputes/:id/messages — Add message to dispute
router.post("/:id/messages", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const dispute = await prisma.dispute.findUnique({ where: { id: req.params.id } });
    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    const isAdmin = req.user!.role === "ADMIN" || req.user!.role === "MANAGER";
    const isBuyer = dispute.buyerId === userId;
    const isSeller = dispute.sellerId === userId;

    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const senderType = isAdmin ? "ADMIN" : isBuyer ? "BUYER" : "SELLER";

    const msg = await prisma.disputeMessage.create({
      data: {
        disputeId: dispute.id,
        senderId: userId,
        senderType,
        senderName: (req.user as any).name || req.user!.email,
        message,
        isInternal: false,
      },
    });

    // If seller is responding, update dispute
    if (isSeller && dispute.status === "OPEN") {
      await prisma.dispute.update({
        where: { id: dispute.id },
        data: {
          status: "SELLER_RESPONSE",
          sellerResponse: message,
          sellerRespondedAt: new Date(),
        },
      });
    }

    return res.status(201).json(msg);
  } catch (error) {
    console.error("Add dispute message error:", error);
    return res.status(500).json({ error: "Failed to add message" });
  }
});

export default router;
