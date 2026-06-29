import { Router, Response } from "express";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";
import { createFlutterwaveTransfer } from "../../services/flutterwave";
import { sendEmail } from "../../lib/email";
import { logActivity } from "../../lib/activityLogger";
import { logger } from "../../lib/logger";
import { asyncHandler } from "../../middleware/errorHandler";

const router = Router();

router.use(authenticate, requireAdmin);

// GET / — List all sellers
router.get("/", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const search = req.query.search as string;
    const status = req.query.status as string;

    const where: any = {};
    if (search) {
      where.OR = [
        { storeName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ];
    }
    if (status && ["PENDING", "APPROVED", "SUSPENDED", "REJECTED"].includes(status)) {
      where.status = status;
    }

    const [rawSellers, total] = await Promise.all([
      prisma.seller.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, email: true, name: true } },
          _count: { select: { products: true, orderItems: true, warnings: true } },
        },
      }),
      prisma.seller.count({ where }),
    ]);

    const sellers = rawSellers.map((s) => ({
      ...s,
      storeLogo: s.logo,
      storeDescription: s.description,
      rating: Number(s.rating),
      totalEarnings: Number(s.totalEarnings),
      commissionRate: s.commissionRate != null ? Number(s.commissionRate) : null,
      balance: Number(s.balance),
      productCount: s._count.products,
      orderCount: s._count.orderItems,
      warningCount: s._count.warnings,
    }));

    return res.json({
      sellers,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error("List sellers error", { error });
    return res.status(500).json({ error: "Failed to load sellers" });
  }
}));

// GET /stats — Marketplace overview stats
router.get("/stats", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const [
      totalSellers,
      pendingApprovals,
      activeSellers,
      totalSellerRevenue,
      totalCommissions,
      pendingPayouts,
    ] = await Promise.all([
      prisma.seller.count(),
      prisma.seller.count({ where: { status: "PENDING" } }),
      prisma.seller.count({ where: { status: "APPROVED" } }),
      prisma.seller.aggregate({ _sum: { totalEarnings: true } }),
      prisma.orderItem.aggregate({
        where: { sellerId: { not: null }, commission: { not: null } },
        _sum: { commission: true },
      }),
      prisma.sellerPayout.aggregate({
        where: { status: { in: ["PENDING", "PROCESSING"] } },
        _sum: { amount: true },
      }),
    ]);

    return res.json({
      totalSellers,
      pendingApproval: pendingApprovals,
      activeSellers,
      totalSellerRevenue: Number(totalSellerRevenue._sum.totalEarnings || 0),
      totalCommissions: Number(totalCommissions._sum.commission || 0),
      pendingPayouts: Number(pendingPayouts._sum.amount || 0),
    });
  } catch (error) {
    logger.error("Marketplace stats error", { error });
    return res.status(500).json({ error: "Failed to load marketplace stats" });
  }
}));

// GET /commissions — List all commission rules
router.get("/commissions", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const rules = await prisma.commissionRule.findMany({
      orderBy: { createdAt: "desc" },
    });
    return res.json({ rules });
  } catch (error) {
    logger.error("List commissions error", { error });
    return res.status(500).json({ error: "Failed to load commission rules" });
  }
}));

// POST /commissions — Create/upsert commission rule
router.post("/commissions", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { categoryId, categoryName, rate } = req.body;

    if (rate === undefined || isNaN(Number(rate)) || Number(rate) < 0 || Number(rate) > 100) {
      return res.status(400).json({ error: "Valid rate (0-100) is required" });
    }

    // Upsert by categoryId (null = default rule)
    const existingRule = await prisma.commissionRule.findFirst({
      where: categoryId ? { categoryId } : { categoryId: null },
    });

    let rule;
    if (existingRule) {
      rule = await prisma.commissionRule.update({
        where: { id: existingRule.id },
        data: {
          rate: Number(rate),
          categoryName: categoryName?.trim() || existingRule.categoryName,
          isActive: true,
        },
      });
    } else {
      rule = await prisma.commissionRule.create({
        data: {
          categoryId: categoryId || null,
          categoryName: categoryName?.trim() || (categoryId ? null : "Default"),
          rate: Number(rate),
        },
      });
    }

    return res.status(201).json({ rule });
  } catch (error) {
    logger.error("Create commission rule error", { error });
    return res.status(500).json({ error: "Failed to create commission rule" });
  }
}));

// PUT /commissions/:id — Update a commission rule
router.put("/commissions/:id", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { rate, categoryName, isActive } = req.body;

    const existing = await prisma.commissionRule.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      return res.status(404).json({ error: "Commission rule not found" });
    }

    const data: any = {};
    if (rate !== undefined) {
      if (isNaN(Number(rate)) || Number(rate) < 0 || Number(rate) > 100) {
        return res.status(400).json({ error: "Valid rate (0-100) is required" });
      }
      data.rate = Number(rate);
    }
    if (categoryName !== undefined) data.categoryName = categoryName?.trim() || null;
    if (isActive !== undefined) data.isActive = !!isActive;

    const rule = await prisma.commissionRule.update({
      where: { id: req.params.id },
      data,
    });

    return res.json({ rule });
  } catch (error) {
    logger.error("Update commission rule error", { error });
    return res.status(500).json({ error: "Failed to update commission rule" });
  }
}));

// DELETE /commissions/:id — Delete a commission rule
router.delete("/commissions/:id", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.commissionRule.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      return res.status(404).json({ error: "Commission rule not found" });
    }

    await prisma.commissionRule.delete({ where: { id: req.params.id } });

    return res.json({ message: "Commission rule deleted" });
  } catch (error) {
    logger.error("Delete commission rule error", { error });
    return res.status(500).json({ error: "Failed to delete commission rule" });
  }
}));

// GET /payouts — List all payout requests
router.get("/payouts", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const status = req.query.status as string;
    const sellerId = req.query.seller as string;

    const where: any = {};
    if (status && ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "REJECTED"].includes(status)) {
      where.status = status;
    }
    if (sellerId) {
      where.sellerId = sellerId;
    }

    const [payouts, total] = await Promise.all([
      prisma.sellerPayout.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          seller: {
            select: { id: true, storeName: true, email: true, payoutMethod: true, payoutPhone: true, bankName: true, bankAccount: true },
          },
        },
      }),
      prisma.sellerPayout.count({ where }),
    ]);

    return res.json({
      payouts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error("List payouts error", { error });
    return res.status(500).json({ error: "Failed to load payouts" });
  }
}));

// PUT /payouts/:id — Process a payout
router.put("/payouts/:id", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { status, reference, notes, autoDisburse } = req.body;

    if (!status || !["PROCESSING", "COMPLETED", "FAILED", "REJECTED"].includes(status)) {
      return res.status(400).json({ error: "Valid status is required" });
    }

    const payout = await prisma.sellerPayout.findUnique({
      where: { id: req.params.id },
      include: {
        seller: {
          select: {
            id: true, storeName: true, payoutMethod: true,
            payoutPhone: true, bankName: true, bankAccount: true,
          },
        },
      },
    });
    if (!payout) {
      return res.status(404).json({ error: "Payout not found" });
    }

    const data: any = { status };
    if (reference) data.reference = reference.trim();
    if (notes) data.notes = notes.trim();

    if (status === "COMPLETED") {
      data.processedAt = new Date();
      data.processedBy = req.user!.id;
    }

    // On REJECTED: refund amount back to seller balance
    if (status === "REJECTED") {
      await prisma.seller.update({
        where: { id: payout.sellerId },
        data: { balance: { increment: Number(payout.amount) } },
      });
    }

    // Auto-disburse via Flutterwave
    if (autoDisburse && payout.status === "PENDING" && payout.seller) {
      const seller = payout.seller;
      let accountBank = "";
      let accountNumber = "";

      if (seller.payoutMethod === "MOBILE_MONEY" || seller.payoutMethod === "FLUTTERWAVE") {
        // MTN Uganda = "MPS", Airtel Uganda = "AIR"
        const cleanPhone = (seller.payoutPhone || "").replace(/\D/g, "");
        let localPhone = cleanPhone;
        if (cleanPhone.startsWith("256") && cleanPhone.length === 12) {
          localPhone = cleanPhone.slice(3);
        } else if (cleanPhone.startsWith("0") && cleanPhone.length === 10) {
          localPhone = cleanPhone.slice(1);
        }
        const prefix2 = localPhone.slice(0, 2);
        if (["70", "75", "74", "20"].includes(prefix2)) {
          accountBank = "AIR"; // Airtel Uganda
        } else {
          accountBank = "MPS"; // MTN Uganda (default / fallback)
        }
        accountNumber = seller.payoutPhone || "";
      } else if (seller.payoutMethod === "BANK_TRANSFER") {
        accountBank = seller.bankName || "";
        accountNumber = seller.bankAccount || "";
      }

      if (accountNumber) {
        try {
          const transferResult = await createFlutterwaveTransfer({
            reference: `payout-${payout.id}`,
            amount: Number(payout.amount),
            narration: `Seller payout to ${seller.storeName}`,
            beneficiary: {
              account_bank: accountBank,
              account_number: accountNumber,
              beneficiary_name: seller.storeName,
            },
          });

          data.status = "PROCESSING";
          data.reference = `payout-${payout.id}`;
          data.notes = `Flutterwave transfer initiated. Transfer ID: ${transferResult.data?.id || "pending"}`;
        } catch (err: any) {
          return res.status(500).json({ error: `Flutterwave transfer failed: ${err.message}` });
        }
      } else {
        return res.status(400).json({ error: "Seller has no payout account configured" });
      }
    }

    const updated = await prisma.sellerPayout.update({
      where: { id: req.params.id },
      data,
      include: {
        seller: { select: { id: true, storeName: true } },
      },
    });

    return res.json({ payout: updated });
  } catch (error) {
    logger.error("Process payout error", { error });
    return res.status(500).json({ error: "Failed to process payout" });
  }
}));

// GET /:id — Single seller detail
router.get("/:id", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const seller = await prisma.seller.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, email: true, name: true, createdAt: true } },
        _count: { select: { products: true, orderItems: true, payouts: true, reviews: true, warnings: true } },
        warnings: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });

    if (!seller) {
      return res.status(404).json({ error: "Seller not found" });
    }

    const [recentProducts, activityLog] = await Promise.all([
      prisma.product.findMany({
        where: { sellerId: seller.id },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          status: true,
          stock: true,
          createdAt: true,
        },
      }),
      prisma.activityLog.findMany({
        where: { entityType: "Seller", entityId: seller.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, action: true, description: true, createdAt: true },
      }),
    ]);

    return res.json({
      seller,
      recentProducts,
      activityLog,
    });
  } catch (error) {
    logger.error("Get seller error", { error });
    return res.status(500).json({ error: "Failed to load seller" });
  }
}));

// PUT /:id/status — Approve/suspend/reject seller
router.put("/:id/status", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { status, rejectionNote } = req.body;

    if (!status || !["APPROVED", "SUSPENDED", "REJECTED", "PENDING"].includes(status)) {
      return res.status(400).json({ error: "Valid status is required" });
    }

    const seller = await prisma.seller.findUnique({
      where: { id: req.params.id },
    });
    if (!seller) {
      return res.status(404).json({ error: "Seller not found" });
    }

    const data: any = { status };

    if (status === "APPROVED") {
      data.verifiedAt = new Date();
      data.rejectionNote = null;
    }
    if (status === "REJECTED") {
      data.rejectionNote = rejectionNote?.trim() || null;
    }

    const updated = await prisma.seller.update({
      where: { id: req.params.id },
      data,
    });

    // On SUSPENDED: set all seller products to DRAFT
    if (status === "SUSPENDED") {
      await prisma.product.updateMany({
        where: { sellerId: seller.id, status: "ACTIVE" },
        data: { status: "DRAFT" },
      });
    }

    // Send email notification on approval or rejection
    const sellerEmail = seller.email || (await prisma.user.findUnique({ where: { id: seller.userId }, select: { email: true } }))?.email;
    if (sellerEmail) {
      if (status === "APPROVED") {
        sendEmail({
          to: sellerEmail,
          template: "seller-approved",
          data: { storeName: seller.storeName },
        }).catch(() => {});
      } else if (status === "REJECTED") {
        sendEmail({
          to: sellerEmail,
          template: "seller-rejected",
          data: { storeName: seller.storeName, rejectionNote: rejectionNote?.trim() || null },
        }).catch(() => {});
      }
    }

    logActivity({
      userId: req.user!.id,
      action: "STATUS_CHANGE",
      entityType: "Seller",
      entityId: seller.id,
      description: `Changed seller "${seller.storeName}" status from ${seller.status} to ${status}`,
      metadata: { from: seller.status, to: status },
    });

    return res.json({ seller: updated });
  } catch (error) {
    logger.error("Update seller status error", { error });
    return res.status(500).json({ error: "Failed to update seller status" });
  }
}));

// PUT /:id — Update seller settings
router.put("/:id", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const seller = await prisma.seller.findUnique({
      where: { id: req.params.id },
    });
    if (!seller) {
      return res.status(404).json({ error: "Seller not found" });
    }

    const { commissionRate, autoApproveProducts } = req.body;

    const data: any = {};
    if (commissionRate !== undefined) {
      if (isNaN(Number(commissionRate)) || Number(commissionRate) < 0 || Number(commissionRate) > 100) {
        return res.status(400).json({ error: "Valid commission rate (0-100) is required" });
      }
      data.commissionRate = Number(commissionRate);
    }
    if (autoApproveProducts !== undefined) {
      data.autoApproveProducts = !!autoApproveProducts;
    }

    const updated = await prisma.seller.update({
      where: { id: req.params.id },
      data,
    });

    logActivity({
      userId: req.user!.id,
      action: "UPDATE_SETTINGS",
      entityType: "Seller",
      entityId: seller.id,
      description: `Updated settings for seller "${seller.storeName}"`,
      metadata: data,
    });

    return res.json({ seller: updated });
  } catch (error) {
    logger.error("Update seller settings error", { error });
    return res.status(500).json({ error: "Failed to update seller settings" });
  }
}));

// ============ WARNINGS ============

// GET /:sellerId/warnings — List seller warnings
router.get("/:sellerId/warnings", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const warnings = await prisma.sellerWarning.findMany({
      where: { sellerId: req.params.sellerId },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ warnings });
  } catch (error) {
    logger.error("List warnings error", { error });
    return res.status(500).json({ error: "Failed to load warnings" });
  }
}));

// POST /:sellerId/warnings — Issue warning
router.post("/:sellerId/warnings", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body;
    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({ error: "Reason is required" });
    }

    const seller = await prisma.seller.findUnique({
      where: { id: req.params.sellerId },
    });
    if (!seller) {
      return res.status(404).json({ error: "Seller not found" });
    }

    // Count active warnings (not expired)
    const activeWarnings = await prisma.sellerWarning.count({
      where: {
        sellerId: seller.id,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    // Auto-determine type
    let type: "WARNING" | "STRIKE" | "FINAL_WARNING" = "WARNING";
    if (activeWarnings >= 2) type = "FINAL_WARNING";
    else if (activeWarnings >= 1) type = "STRIKE";

    // 3+ active: auto-suspend
    if (activeWarnings >= 3) {
      await prisma.seller.update({
        where: { id: seller.id },
        data: { status: "SUSPENDED" },
      });
      await prisma.product.updateMany({
        where: { sellerId: seller.id, status: "ACTIVE" },
        data: { status: "DRAFT" },
      });

      logActivity({
        userId: req.user!.id,
        action: "AUTO_SUSPENDED",
        entityType: "Seller",
        entityId: seller.id,
        description: `Auto-suspended seller "${seller.storeName}" after ${activeWarnings + 1} warnings`,
      });
    }

    const warning = await prisma.sellerWarning.create({
      data: {
        sellerId: seller.id,
        type,
        reason: reason.trim(),
        issuedBy: req.user!.id,
      },
    });

    logActivity({
      userId: req.user!.id,
      action: "WARNING_ISSUED",
      entityType: "Seller",
      entityId: seller.id,
      description: `Issued ${type} to seller "${seller.storeName}": ${reason.trim()}`,
    });

    // Send email
    const sellerEmail = seller.email || (await prisma.user.findUnique({ where: { id: seller.userId }, select: { email: true } }))?.email;
    if (sellerEmail) {
      sendEmail({
        to: sellerEmail,
        template: "seller-warning",
        data: { storeName: seller.storeName, type, reason: reason.trim(), activeCount: activeWarnings + 1 },
      }).catch(() => {});
    }

    return res.status(201).json({ warning, autoSuspended: activeWarnings >= 3 });
  } catch (error) {
    logger.error("Issue warning error", { error });
    return res.status(500).json({ error: "Failed to issue warning" });
  }
}));

// DELETE /:sellerId/warnings/:id — Expire a warning
router.delete("/:sellerId/warnings/:id", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const warning = await prisma.sellerWarning.findUnique({
      where: { id: req.params.id },
    });
    if (!warning || warning.sellerId !== req.params.sellerId) {
      return res.status(404).json({ error: "Warning not found" });
    }

    const updated = await prisma.sellerWarning.update({
      where: { id: req.params.id },
      data: { expiresAt: new Date() },
    });

    return res.json({ warning: updated });
  } catch (error) {
    logger.error("Expire warning error", { error });
    return res.status(500).json({ error: "Failed to expire warning" });
  }
}));

// ============ SCORECARD ============

// GET /:id/scorecard — Performance scorecard
router.get("/:id/scorecard", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const seller = await prisma.seller.findUnique({
      where: { id: req.params.id },
      select: { id: true, rating: true },
    });
    if (!seller) {
      return res.status(404).json({ error: "Seller not found" });
    }

    const [totalItems, shippedDelivered, returnCount, avgResponseTime] = await Promise.all([
      prisma.orderItem.count({ where: { sellerId: seller.id } }),
      prisma.orderItem.count({
        where: {
          sellerId: seller.id,
          order: { status: { in: ["SHIPPED", "DELIVERED"] } },
        },
      }),
      prisma.returnRequest.count({
        where: { order: { items: { some: { sellerId: seller.id } } } },
      }),
      // Average response time: get seller conversations with messages
      prisma.$queryRawUnsafe<{ avg_minutes: number }[]>(`
        SELECT COALESCE(AVG(response_minutes), 0) as avg_minutes FROM (
          SELECT EXTRACT(EPOCH FROM (
            (SELECT MIN(cm2."createdAt") FROM "ChatMessage" cm2
             WHERE cm2."conversationId" = cm."conversationId"
             AND cm2."senderType" = 'SELLER'
             AND cm2."createdAt" > cm."createdAt")
            - cm."createdAt"
          )) / 60 as response_minutes
          FROM "ChatMessage" cm
          JOIN "Conversation" c ON c.id = cm."conversationId"
          WHERE c."sellerId" = $1
          AND cm."senderType" = 'BUYER'
          LIMIT 100
        ) sub
        WHERE response_minutes IS NOT NULL AND response_minutes > 0
      `, seller.id),
    ]);

    const fulfillmentRate = totalItems > 0 ? Math.round((shippedDelivered / totalItems) * 100) : 100;
    const returnRate = totalItems > 0 ? Math.round((returnCount / totalItems) * 100) : 0;
    const customerRating = Number(seller.rating);
    const responseTimeMinutes = Math.round(avgResponseTime[0]?.avg_minutes || 0);

    const flags: string[] = [];
    if (fulfillmentRate < 80) flags.push("Low fulfillment rate");
    if (customerRating < 3.0) flags.push("Low customer rating");
    if (returnRate > 10) flags.push("High return rate");

    return res.json({
      scorecard: {
        fulfillmentRate,
        returnRate,
        customerRating,
        responseTimeMinutes,
        totalOrders: totalItems,
        flags,
      },
    });
  } catch (error) {
    logger.error("Scorecard error", { error });
    return res.status(500).json({ error: "Failed to load scorecard" });
  }
}));

export default router;
