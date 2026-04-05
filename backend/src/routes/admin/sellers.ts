import { Router, Response } from "express";
import prisma from "../../lib/prisma";
import { authenticate, requireAdmin, AuthRequest } from "../../middleware/auth";

const router = Router();

router.use(authenticate, requireAdmin);

// GET / — List all sellers
router.get("/", async (req: AuthRequest, res: Response) => {
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

    const [sellers, total] = await Promise.all([
      prisma.seller.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, email: true, name: true } },
          _count: { select: { products: true, orderItems: true } },
        },
      }),
      prisma.seller.count({ where }),
    ]);

    return res.json({
      sellers,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("List sellers error:", error);
    return res.status(500).json({ error: "Failed to load sellers" });
  }
});

// GET /stats — Marketplace overview stats
router.get("/stats", async (req: AuthRequest, res: Response) => {
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
      pendingApprovals,
      activeSellers,
      totalSellerRevenue: totalSellerRevenue._sum.totalEarnings || 0,
      totalCommissions: totalCommissions._sum.commission || 0,
      pendingPayouts: pendingPayouts._sum.amount || 0,
    });
  } catch (error) {
    console.error("Marketplace stats error:", error);
    return res.status(500).json({ error: "Failed to load marketplace stats" });
  }
});

// GET /commissions — List all commission rules
router.get("/commissions", async (req: AuthRequest, res: Response) => {
  try {
    const rules = await prisma.commissionRule.findMany({
      orderBy: { createdAt: "desc" },
    });
    return res.json({ rules });
  } catch (error) {
    console.error("List commissions error:", error);
    return res.status(500).json({ error: "Failed to load commission rules" });
  }
});

// POST /commissions — Create/upsert commission rule
router.post("/commissions", async (req: AuthRequest, res: Response) => {
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
    console.error("Create commission rule error:", error);
    return res.status(500).json({ error: "Failed to create commission rule" });
  }
});

// PUT /commissions/:id — Update a commission rule
router.put("/commissions/:id", async (req: AuthRequest, res: Response) => {
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
    console.error("Update commission rule error:", error);
    return res.status(500).json({ error: "Failed to update commission rule" });
  }
});

// DELETE /commissions/:id — Delete a commission rule
router.delete("/commissions/:id", async (req: AuthRequest, res: Response) => {
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
    console.error("Delete commission rule error:", error);
    return res.status(500).json({ error: "Failed to delete commission rule" });
  }
});

// GET /payouts — List all payout requests
router.get("/payouts", async (req: AuthRequest, res: Response) => {
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
    console.error("List payouts error:", error);
    return res.status(500).json({ error: "Failed to load payouts" });
  }
});

// PUT /payouts/:id — Process a payout
router.put("/payouts/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { status, reference, notes } = req.body;

    if (!status || !["PROCESSING", "COMPLETED", "FAILED", "REJECTED"].includes(status)) {
      return res.status(400).json({ error: "Valid status is required" });
    }

    const payout = await prisma.sellerPayout.findUnique({
      where: { id: req.params.id },
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

    const updated = await prisma.sellerPayout.update({
      where: { id: req.params.id },
      data,
      include: {
        seller: { select: { id: true, storeName: true } },
      },
    });

    return res.json({ payout: updated });
  } catch (error) {
    console.error("Process payout error:", error);
    return res.status(500).json({ error: "Failed to process payout" });
  }
});

// GET /:id — Single seller detail
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const seller = await prisma.seller.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, email: true, name: true, createdAt: true } },
        _count: { select: { products: true, orderItems: true, payouts: true, reviews: true } },
      },
    });

    if (!seller) {
      return res.status(404).json({ error: "Seller not found" });
    }

    const recentProducts = await prisma.product.findMany({
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
    });

    return res.json({
      seller,
      recentProducts,
    });
  } catch (error) {
    console.error("Get seller error:", error);
    return res.status(500).json({ error: "Failed to load seller" });
  }
});

// PUT /:id/status — Approve/suspend/reject seller
router.put("/:id/status", async (req: AuthRequest, res: Response) => {
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

    return res.json({ seller: updated });
  } catch (error) {
    console.error("Update seller status error:", error);
    return res.status(500).json({ error: "Failed to update seller status" });
  }
});

// PUT /:id — Update seller settings
router.put("/:id", async (req: AuthRequest, res: Response) => {
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

    return res.json({ seller: updated });
  } catch (error) {
    console.error("Update seller settings error:", error);
    return res.status(500).json({ error: "Failed to update seller settings" });
  }
});

export default router;
