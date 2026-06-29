import { Router, Response } from "express";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";
import { refundFlutterwaveTransaction } from "../../services/flutterwave";
import { logger } from "../../lib/logger";
import { asyncHandler } from "../../middleware/errorHandler";

const router = Router();

router.use(authenticate, requireAdmin);

// GET /api/admin/disputes — List all disputes
router.get("/", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const {
      search,
      status,
      category,
      priority,
      sellerId,
      dateFrom,
      dateTo,
      sort = "createdAt",
      order = "desc",
      page = "1",
      limit = "20",
    } = req.query;

    const take = Math.min(parseInt(limit as string) || 20, 100);
    const skip = (Math.max(parseInt(page as string) || 1, 1) - 1) * take;

    const where: any = {};

    if (search) {
      where.OR = [
        { disputeNumber: { contains: search, mode: "insensitive" } },
        { order: { orderNumber: { contains: search, mode: "insensitive" } } },
        { buyer: { name: { contains: search, mode: "insensitive" } } },
        { seller: { storeName: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (status) where.status = status;
    if (category) where.category = category;
    if (priority) where.priority = priority;
    if (sellerId) where.sellerId = sellerId;

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom as string);
      if (dateTo) where.createdAt.lte = new Date(dateTo as string);
    }

    const orderBy: any = {};
    orderBy[sort as string] = order;

    const [disputes, total, stats] = await Promise.all([
      prisma.dispute.findMany({
        where,
        orderBy,
        take,
        skip,
        include: {
          order: {
            select: { orderNumber: true, totalAmount: true, currency: true },
          },
          buyer: { select: { name: true, email: true } },
          seller: { select: { storeName: true, logo: true } },
          _count: { select: { evidence: true, messages: true } },
        },
      }),
      prisma.dispute.count({ where }),
      // Stats
      Promise.all([
        prisma.dispute.count({ where: { status: "OPEN" } }),
        prisma.dispute.count({ where: { status: "UNDER_REVIEW" } }),
        prisma.dispute.count({ where: { status: "SELLER_RESPONSE" } }),
        prisma.dispute.count({ where: { status: "RESOLVED" } }),
        prisma.dispute.count(),
        // SLA metrics
        prisma.dispute.count({ where: { sellerDeadline: { lt: new Date() }, status: { in: ["OPEN", "SELLER_RESPONSE"] } } }),
        // Average resolution time (resolved disputes)
        prisma.$queryRaw<[{ avg_hours: number }]>`
          SELECT COALESCE(AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 3600), 0)::float8 as avg_hours
          FROM "Dispute" WHERE "resolvedAt" IS NOT NULL`,
      ]),
    ]);

    return res.json({
      disputes,
      total,
      page: parseInt(page as string) || 1,
      totalPages: Math.ceil(total / take),
      stats: {
        open: stats[0],
        underReview: stats[1],
        sellerResponse: stats[2],
        resolved: stats[3],
        total: stats[4],
        overdueCount: stats[5],
        avgResolutionHours: Math.round((stats[6] as any)?.[0]?.avg_hours || 0),
      },
    });
  } catch (error) {
    logger.error("List disputes error", { error });
    return res.status(500).json({ error: "Failed to fetch disputes" });
  }
}));

// GET /api/admin/disputes/:id — Get dispute details
router.get("/:id", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const dispute = await prisma.dispute.findUnique({
      where: { id: req.params.id },
      include: {
        order: {
          include: {
            items: {
              include: {
                product: {
                  select: { name: true, slug: true, images: { take: 1 } },
                },
              },
            },
            payments: { select: { id: true, method: true, status: true, amount: true, flwRef: true } },
            escrow: true,
          },
        },
        buyer: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
        seller: {
          select: {
            id: true, storeName: true, logo: true, rating: true,
            reviewCount: true, status: true, tier: true, trustScore: true,
          },
        },
        evidence: { orderBy: { createdAt: "desc" } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    return res.json(dispute);
  } catch (error) {
    logger.error("Get dispute error", { error });
    return res.status(500).json({ error: "Failed to fetch dispute" });
  }
}));

// PUT /api/admin/disputes/:id — Update dispute status / resolve
router.put("/:id", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user!.id;
    const { status, resolution, resolutionNote, refundAmount, priority } = req.body;

    const dispute = await prisma.dispute.findUnique({
      where: { id: req.params.id },
      include: {
        order: {
          include: {
            payments: true,
            escrow: true,
          },
        },
      },
    });

    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    const updateData: any = {};

    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (resolutionNote) updateData.resolutionNote = resolutionNote;

    // Assign to admin if not yet assigned
    if (!dispute.assignedTo) {
      updateData.assignedTo = adminId;
    }

    // Handle resolution
    if (resolution) {
      updateData.resolution = resolution;
      updateData.resolvedBy = adminId;
      updateData.resolvedAt = new Date();
      updateData.status = "RESOLVED";

      const escrow = dispute.order.escrow;

      // Process refund if applicable
      if (
        refundAmount &&
        parseFloat(refundAmount) > 0 &&
        ["BUYER_FULL_REFUND", "BUYER_PARTIAL_REFUND"].includes(resolution)
      ) {
        updateData.refundAmount = parseFloat(refundAmount);

        // Update escrow
        if (escrow) {
          await prisma.escrowTransaction.update({
            where: { id: escrow.id },
            data: {
              status: resolution === "BUYER_FULL_REFUND" ? "REFUNDED" : "PARTIAL_REFUND",
              notes: `Dispute ${dispute.disputeNumber} resolved: ${resolution}`,
            },
          });
        }

        // Process actual refund via payment provider
        const payment = dispute.order.payments.find((p) => p.status === "SUCCESSFUL");
        if (payment && payment.flwRef) {
          try {
            await refundFlutterwaveTransaction(payment.flwRef, parseFloat(refundAmount));
          } catch (refundErr) {
            logger.error("Auto-refund failed, needs manual processing", { error: refundErr });
          }
        }

        // Update order
        await prisma.order.update({
          where: { id: dispute.orderId },
          data: {
            status: "REFUNDED",
            paymentStatus: "REFUNDED",
          },
        });
      } else if (resolution === "SELLER_WINS" && escrow) {
        // Release escrow to seller
        await prisma.escrowTransaction.update({
          where: { id: escrow.id },
          data: {
            status: "RELEASED",
            releasedAt: new Date(),
            releasedTo: dispute.sellerId,
            notes: `Dispute ${dispute.disputeNumber} resolved in seller's favor`,
          },
        });

        // Credit seller balance
        const escrowAmount = parseFloat(escrow.amount.toString());
        const commissionRate = 0.15; // Default, should compute actual
        const commission = escrowAmount * commissionRate;
        const sellerAmount = escrowAmount - commission;

        await prisma.seller.update({
          where: { id: dispute.sellerId },
          data: {
            balance: { increment: sellerAmount },
            totalEarnings: { increment: sellerAmount },
          },
        });
      }

      // Add timeline event
      await prisma.orderEvent.create({
        data: {
          orderId: dispute.orderId,
          status: "DISPUTE_RESOLVED",
          note: `Dispute resolved: ${resolution}${resolutionNote ? ` - ${resolutionNote}` : ""}`,
        },
      });
    }

    const updated = await prisma.dispute.update({
      where: { id: req.params.id },
      data: updateData,
    });

    return res.json(updated);
  } catch (error) {
    logger.error("Update dispute error", { error });
    return res.status(500).json({ error: "Failed to update dispute" });
  }
}));

// POST /api/admin/disputes/:id/messages — Admin message on dispute
router.post("/:id/messages", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { message, isInternal } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const dispute = await prisma.dispute.findUnique({ where: { id: req.params.id } });
    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    const msg = await prisma.disputeMessage.create({
      data: {
        disputeId: dispute.id,
        senderId: req.user!.id,
        senderType: "ADMIN",
        senderName: (req.user as any).name || "Admin",
        message,
        isInternal: isInternal || false,
      },
    });

    // Update status to UNDER_REVIEW if currently OPEN or SELLER_RESPONSE
    if (["OPEN", "SELLER_RESPONSE"].includes(dispute.status)) {
      await prisma.dispute.update({
        where: { id: dispute.id },
        data: { status: "UNDER_REVIEW", assignedTo: req.user!.id },
      });
    }

    return res.status(201).json(msg);
  } catch (error) {
    logger.error("Admin dispute message error", { error });
    return res.status(500).json({ error: "Failed to add message" });
  }
}));

export default router;
