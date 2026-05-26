import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { uploadMultiple, validateUploadedFiles } from "../middleware/upload";

const router = Router();

function requireSeller(req: AuthRequest, res: Response): boolean {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return false;
  }
  if (req.user.role !== "SELLER") {
    res.status(403).json({ error: "Seller access required" });
    return false;
  }
  return true;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function getCommissionRate(sellerId: string, categoryId: string | null): Promise<number> {
  // 1. Try category-specific rule
  if (categoryId) {
    const categoryRule = await prisma.commissionRule.findUnique({
      where: { categoryId, isActive: true },
    });
    if (categoryRule) return Number(categoryRule.rate);
  }

  // 2. Try seller-specific override
  const seller = await prisma.seller.findUnique({
    where: { id: sellerId },
    select: { commissionRate: true },
  });
  if (seller?.commissionRate !== null && seller?.commissionRate !== undefined) {
    return Number(seller.commissionRate);
  }

  // 3. Try default commission rule (categoryId = null)
  const defaultRule = await prisma.commissionRule.findFirst({
    where: { categoryId: null, isActive: true },
  });
  if (defaultRule) return Number(defaultRule.rate);

  // 4. Fallback
  return 15;
}

// ============ PUBLIC ROUTES ============

// POST /register — Register as a seller
router.post("/register", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { storeName, description, phone, email, address, city } = req.body;

    if (!storeName || typeof storeName !== "string" || storeName.trim().length < 2) {
      return res.status(400).json({ error: "Store name is required (min 2 characters)" });
    }

    // Check if user already has a seller account
    const existing = await prisma.seller.findUnique({
      where: { userId: req.user.id },
    });
    if (existing) {
      return res.status(400).json({ error: "You already have a seller account" });
    }

    const trimmedName = storeName.trim();
    let storeSlug = slugify(trimmedName);

    // Ensure unique slug
    const slugExists = await prisma.seller.findUnique({ where: { storeSlug } });
    if (slugExists) {
      storeSlug = `${storeSlug}-${Date.now().toString(36)}`;
    }

    const seller = await prisma.seller.create({
      data: {
        userId: req.user.id,
        storeName: trimmedName,
        storeSlug,
        description: description?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        city: city?.trim() || null,
        status: "PENDING",
      },
    });

    // Update user role to SELLER
    await prisma.user.update({
      where: { id: req.user.id },
      data: { role: "SELLER" },
    });

    return res.status(201).json({ seller });
  } catch (error) {
    console.error("Seller registration error:", error);
    return res.status(500).json({ error: "Failed to register as seller" });
  }
});

// GET /store/:slug — Public seller profile
router.get("/store/:slug", async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;

    const seller = await prisma.seller.findUnique({
      where: { storeSlug: slug },
      select: {
        id: true,
        storeName: true,
        storeSlug: true,
        description: true,
        logo: true,
        banner: true,
        city: true,
        country: true,
        rating: true,
        reviewCount: true,
        createdAt: true,
        status: true,
      },
    });

    if (!seller || seller.status !== "APPROVED") {
      return res.status(404).json({ error: "Store not found" });
    }

    const productCount = await prisma.product.count({
      where: { sellerId: seller.id, status: "ACTIVE" },
    });

    return res.json({ seller: { ...seller, productCount } });
  } catch (error) {
    console.error("Get store error:", error);
    return res.status(500).json({ error: "Failed to load store" });
  }
});

// GET /store/:slug/products — Public seller product listing
router.get("/store/:slug/products", async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const seller = await prisma.seller.findUnique({
      where: { storeSlug: slug },
      select: { id: true, status: true },
    });

    if (!seller || seller.status !== "APPROVED") {
      return res.status(404).json({ error: "Store not found" });
    }

    const where: any = { sellerId: seller.id, status: "ACTIVE" };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          images: { take: 1 },
          category: { select: { id: true, name: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return res.json({
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get store products error:", error);
    return res.status(500).json({ error: "Failed to load store products" });
  }
});

// ============ SELLER AUTHENTICATED ROUTES ============

// GET /dashboard — Seller dashboard stats
router.get("/dashboard", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireSeller(req, res)) return;

    const seller = await prisma.seller.findUnique({
      where: { userId: req.user!.id },
    });
    if (!seller) {
      return res.status(404).json({ error: "Seller account not found" });
    }

    const [totalProducts, activeProducts, totalOrders, recentOrders, topProducts] =
      await Promise.all([
        prisma.product.count({ where: { sellerId: seller.id } }),
        prisma.product.count({ where: { sellerId: seller.id, status: "ACTIVE" } }),
        prisma.orderItem.count({ where: { sellerId: seller.id } }),
        prisma.orderItem.findMany({
          where: { sellerId: seller.id },
          orderBy: { order: { createdAt: "desc" } },
          take: 10,
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                createdAt: true,
                customerName: true,
              },
            },
          },
        }),
        prisma.orderItem.groupBy({
          by: ["productId"],
          where: { sellerId: seller.id },
          _sum: { quantity: true },
          orderBy: { _sum: { quantity: "desc" } },
          take: 5,
        }),
      ]);

    // Fetch product details for top products
    const topProductIds = topProducts.map((p) => p.productId);
    const topProductDetails = topProductIds.length
      ? await prisma.product.findMany({
          where: { id: { in: topProductIds } },
          select: { id: true, name: true, slug: true, price: true },
        })
      : [];

    const topProductsWithDetails = topProducts.map((tp) => ({
      ...tp,
      product: topProductDetails.find((p) => p.id === tp.productId),
    }));

    return res.json({
      totalProducts,
      activeProducts,
      totalOrders,
      totalEarnings: seller.totalEarnings,
      balance: seller.balance,
      totalSales: seller.totalSales,
      status: seller.status,
      rating: seller.rating,
      reviewCount: seller.reviewCount,
      recentOrders,
      topProducts: topProductsWithDetails,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return res.status(500).json({ error: "Failed to load dashboard" });
  }
});

// GET /products — List seller's own products
router.get("/products", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireSeller(req, res)) return;

    const seller = await prisma.seller.findUnique({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    if (!seller) {
      return res.status(404).json({ error: "Seller account not found" });
    }

    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const search = req.query.search as string;
    const status = req.query.status as string;

    const where: any = { sellerId: seller.id };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
      ];
    }
    if (status && ["DRAFT", "ACTIVE", "ARCHIVED"].includes(status)) {
      where.status = status;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          images: { take: 1 },
          category: { select: { id: true, name: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return res.json({
      products,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("List seller products error:", error);
    return res.status(500).json({ error: "Failed to load products" });
  }
});

// POST /products — Create a product as seller
router.post("/products", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireSeller(req, res)) return;

    const seller = await prisma.seller.findUnique({
      where: { userId: req.user!.id },
    });
    if (!seller) {
      return res.status(404).json({ error: "Seller account not found" });
    }
    if (seller.status !== "APPROVED") {
      return res.status(403).json({ error: "Seller account is not approved" });
    }

    const {
      name,
      description,
      price,
      comparePrice,
      sku,
      stock,
      categoryId,
      tags,
      images,
      weight,
      specifications,
      metaTitle,
      metaDescription,
      trackInventory,
      allowBackorder,
      lowStockAlert,
    } = req.body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return res.status(400).json({ error: "Product name is required" });
    }
    if (price === undefined || isNaN(Number(price)) || Number(price) < 0) {
      return res.status(400).json({ error: "Valid price is required" });
    }

    // Generate slug
    let slug = slugify(name.trim());
    const slugExists = await prisma.product.findUnique({ where: { slug } });
    if (slugExists) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    // Determine product status
    let productStatus: "DRAFT" | "ACTIVE" = "ACTIVE";
    if (!seller.autoApproveProducts) {
      productStatus = "DRAFT";
    }

    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        price: Number(price),
        comparePrice: comparePrice ? Number(comparePrice) : null,
        sku: sku?.trim() || null,
        stock: parseInt(stock) || 0,
        categoryId: categoryId || null,
        tags: Array.isArray(tags) ? tags : [],
        sellerId: seller.id,
        status: productStatus,
        weight: weight ? Number(weight) : null,
        specifications: specifications || null,
        metaTitle: metaTitle?.trim() || null,
        metaDescription: metaDescription?.trim() || null,
        trackInventory: trackInventory !== false,
        allowBackorder: allowBackorder === true,
        lowStockAlert: parseInt(lowStockAlert) || 5,
        images: images?.length
          ? {
              create: images.map((img: { url: string; alt?: string }, idx: number) => ({
                url: img.url,
                alt: img.alt || name.trim(),
                order: idx,
              })),
            }
          : undefined,
      },
      include: {
        images: true,
        category: { select: { id: true, name: true } },
      },
    });

    return res.status(201).json({ product });
  } catch (error) {
    console.error("Create product error:", error);
    return res.status(500).json({ error: "Failed to create product" });
  }
});

// PUT /products/:id — Update own product
router.put("/products/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireSeller(req, res)) return;

    const seller = await prisma.seller.findUnique({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    if (!seller) {
      return res.status(404).json({ error: "Seller account not found" });
    }

    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      select: { id: true, sellerId: true },
    });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    if (product.sellerId !== seller.id) {
      return res.status(403).json({ error: "You can only update your own products" });
    }

    const {
      name,
      description,
      price,
      comparePrice,
      sku,
      stock,
      categoryId,
      tags,
      weight,
      specifications,
      metaTitle,
      metaDescription,
      status,
      trackInventory,
      allowBackorder,
      lowStockAlert,
    } = req.body;

    const data: any = {};
    if (name !== undefined) data.name = name.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (price !== undefined) data.price = Number(price);
    if (comparePrice !== undefined) data.comparePrice = comparePrice ? Number(comparePrice) : null;
    if (sku !== undefined) data.sku = sku?.trim() || null;
    if (stock !== undefined) data.stock = parseInt(stock) || 0;
    if (categoryId !== undefined) data.categoryId = categoryId || null;
    if (tags !== undefined) data.tags = Array.isArray(tags) ? tags : [];
    if (weight !== undefined) data.weight = weight ? Number(weight) : null;
    if (specifications !== undefined) data.specifications = specifications || null;
    if (metaTitle !== undefined) data.metaTitle = metaTitle?.trim() || null;
    if (metaDescription !== undefined) data.metaDescription = metaDescription?.trim() || null;
    if (trackInventory !== undefined) data.trackInventory = !!trackInventory;
    if (allowBackorder !== undefined) data.allowBackorder = !!allowBackorder;
    if (lowStockAlert !== undefined) data.lowStockAlert = parseInt(lowStockAlert) || 5;
    // Sellers can only set DRAFT or ACTIVE
    if (status !== undefined && ["DRAFT", "ACTIVE"].includes(status)) {
      data.status = status;
    }

    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data,
      include: {
        images: true,
        category: { select: { id: true, name: true } },
      },
    });

    return res.json({ product: updated });
  } catch (error) {
    console.error("Update product error:", error);
    return res.status(500).json({ error: "Failed to update product" });
  }
});

// DELETE /products/:id — Soft delete (set to DRAFT)
router.delete("/products/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireSeller(req, res)) return;

    const seller = await prisma.seller.findUnique({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    if (!seller) {
      return res.status(404).json({ error: "Seller account not found" });
    }

    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      select: { id: true, sellerId: true },
    });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    if (product.sellerId !== seller.id) {
      return res.status(403).json({ error: "You can only delete your own products" });
    }

    await prisma.product.update({
      where: { id: req.params.id },
      data: { status: "DRAFT" },
    });

    return res.json({ message: "Product removed from listing" });
  } catch (error) {
    console.error("Delete product error:", error);
    return res.status(500).json({ error: "Failed to delete product" });
  }
});

// GET /orders — List orders containing seller's items
router.get("/orders", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireSeller(req, res)) return;

    const seller = await prisma.seller.findUnique({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    if (!seller) {
      return res.status(404).json({ error: "Seller account not found" });
    }

    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const status = req.query.status as string;

    // Find order IDs that have items belonging to this seller
    const orderItemWhere: any = { sellerId: seller.id };
    const sellerOrderItems = await prisma.orderItem.findMany({
      where: orderItemWhere,
      select: { orderId: true },
      distinct: ["orderId"],
    });
    const orderIds = sellerOrderItems.map((oi) => oi.orderId);

    if (orderIds.length === 0) {
      return res.json({
        orders: [],
        pagination: { page, limit, total: 0, pages: 0 },
      });
    }

    const orderWhere: any = { id: { in: orderIds } };
    if (status && ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"].includes(status)) {
      orderWhere.status = status;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: orderWhere,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            where: { sellerId: seller.id },
            include: { product: { select: { id: true, name: true, slug: true } } },
          },
        },
      }),
      prisma.order.count({ where: orderWhere }),
    ]);

    return res.json({
      orders,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("List seller orders error:", error);
    return res.status(500).json({ error: "Failed to load orders" });
  }
});

// GET /orders/:id — Single order detail for seller's items
router.get("/orders/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireSeller(req, res)) return;

    const seller = await prisma.seller.findUnique({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    if (!seller) {
      return res.status(404).json({ error: "Seller account not found" });
    }

    // Verify seller has items in this order
    const sellerItems = await prisma.orderItem.findMany({
      where: { orderId: req.params.id, sellerId: seller.id },
    });
    if (sellerItems.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          where: { sellerId: seller.id },
          include: { product: { select: { id: true, name: true, slug: true } } },
        },
        timeline: { orderBy: { createdAt: "desc" } },
      },
    });

    return res.json({ order });
  } catch (error) {
    console.error("Get seller order error:", error);
    return res.status(500).json({ error: "Failed to load order" });
  }
});

// PUT /orders/:id/status — Update fulfillment status for seller's items
router.put("/orders/:id/status", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireSeller(req, res)) return;

    const seller = await prisma.seller.findUnique({
      where: { userId: req.user!.id },
      select: { id: true, storeName: true },
    });
    if (!seller) {
      return res.status(404).json({ error: "Seller account not found" });
    }

    const { status, trackingNumber } = req.body;

    // Sellers can only set PROCESSING or SHIPPED
    if (!status || !["PROCESSING", "SHIPPED"].includes(status)) {
      return res.status(400).json({ error: "Sellers can only set status to PROCESSING or SHIPPED" });
    }

    // Verify seller has items in this order
    const sellerItems = await prisma.orderItem.findMany({
      where: { orderId: req.params.id, sellerId: seller.id },
    });
    if (sellerItems.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const updateData: any = { status };
    if (trackingNumber) {
      updateData.trackingNumber = trackingNumber.trim();
    }

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: updateData,
    });

    // Add timeline event
    await prisma.orderEvent.create({
      data: {
        orderId: req.params.id,
        status,
        note: `Status updated to ${status} by seller: ${seller.storeName}`,
      },
    });

    return res.json({ order });
  } catch (error) {
    console.error("Update order status error:", error);
    return res.status(500).json({ error: "Failed to update order status" });
  }
});

// GET /earnings — Earnings summary
router.get("/earnings", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireSeller(req, res)) return;

    const seller = await prisma.seller.findUnique({
      where: { userId: req.user!.id },
    });
    if (!seller) {
      return res.status(404).json({ error: "Seller account not found" });
    }

    const totalWithdrawn = await prisma.sellerPayout.aggregate({
      where: { sellerId: seller.id, status: "COMPLETED" },
      _sum: { amount: true },
    });

    const pendingPayouts = await prisma.sellerPayout.aggregate({
      where: { sellerId: seller.id, status: { in: ["PENDING", "PROCESSING"] } },
      _sum: { amount: true },
    });

    const recentItems = await prisma.orderItem.findMany({
      where: { sellerId: seller.id },
      orderBy: { order: { createdAt: "desc" } },
      take: 20,
      include: {
        order: { select: { id: true, orderNumber: true, createdAt: true, status: true } },
        product: { select: { id: true, name: true } },
      },
    });

    return res.json({
      totalEarnings: seller.totalEarnings,
      balance: seller.balance,
      totalWithdrawn: totalWithdrawn._sum.amount || 0,
      pendingPayouts: pendingPayouts._sum.amount || 0,
      recentTransactions: recentItems,
    });
  } catch (error) {
    console.error("Earnings error:", error);
    return res.status(500).json({ error: "Failed to load earnings" });
  }
});

// POST /payouts/request — Request a payout
router.post("/payouts/request", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireSeller(req, res)) return;

    const seller = await prisma.seller.findUnique({
      where: { userId: req.user!.id },
    });
    if (!seller) {
      return res.status(404).json({ error: "Seller account not found" });
    }
    if (seller.status !== "APPROVED") {
      return res.status(403).json({ error: "Seller account is not approved" });
    }

    const { amount, method } = req.body;
    const payoutAmount = Number(amount);

    if (!amount || isNaN(payoutAmount) || payoutAmount <= 0) {
      return res.status(400).json({ error: "Valid payout amount is required" });
    }

    if (payoutAmount > Number(seller.balance)) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    const payoutMethod = method && ["MOBILE_MONEY", "BANK_TRANSFER", "FLUTTERWAVE"].includes(method)
      ? method
      : seller.payoutMethod || "MOBILE_MONEY";

    // Create payout and deduct balance atomically
    const [payout] = await prisma.$transaction([
      prisma.sellerPayout.create({
        data: {
          sellerId: seller.id,
          amount: payoutAmount,
          method: payoutMethod,
          status: "PENDING",
        },
      }),
      prisma.seller.update({
        where: { id: seller.id },
        data: {
          balance: { decrement: payoutAmount },
        },
      }),
    ]);

    return res.status(201).json({ payout });
  } catch (error) {
    console.error("Payout request error:", error);
    return res.status(500).json({ error: "Failed to request payout" });
  }
});

// GET /payouts — List payout history
router.get("/payouts", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireSeller(req, res)) return;

    const seller = await prisma.seller.findUnique({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    if (!seller) {
      return res.status(404).json({ error: "Seller account not found" });
    }

    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const [payouts, total] = await Promise.all([
      prisma.sellerPayout.findMany({
        where: { sellerId: seller.id },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.sellerPayout.count({ where: { sellerId: seller.id } }),
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

// PUT /profile — Update seller profile
router.put("/profile", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireSeller(req, res)) return;

    const seller = await prisma.seller.findUnique({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    if (!seller) {
      return res.status(404).json({ error: "Seller account not found" });
    }

    const {
      storeName,
      description,
      logo,
      banner,
      phone,
      email,
      website,
      address,
      city,
      country,
      payoutMethod,
      payoutPhone,
      bankName,
      bankAccount,
      bankBranch,
    } = req.body;

    const data: any = {};
    if (storeName !== undefined) data.storeName = storeName.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (logo !== undefined) data.logo = logo || null;
    if (banner !== undefined) data.banner = banner || null;
    if (phone !== undefined) data.phone = phone?.trim() || null;
    if (email !== undefined) data.email = email?.trim() || null;
    if (website !== undefined) data.website = website?.trim() || null;
    if (address !== undefined) data.address = address?.trim() || null;
    if (city !== undefined) data.city = city?.trim() || null;
    if (country !== undefined) data.country = country?.trim() || null;
    if (payoutMethod !== undefined && ["MOBILE_MONEY", "BANK_TRANSFER", "FLUTTERWAVE"].includes(payoutMethod)) {
      data.payoutMethod = payoutMethod;
    }
    if (payoutPhone !== undefined) data.payoutPhone = payoutPhone?.trim() || null;
    if (bankName !== undefined) data.bankName = bankName?.trim() || null;
    if (bankAccount !== undefined) data.bankAccount = bankAccount?.trim() || null;
    if (bankBranch !== undefined) data.bankBranch = bankBranch?.trim() || null;

    const updated = await prisma.seller.update({
      where: { id: seller.id },
      data,
    });

    return res.json({ seller: updated });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({ error: "Failed to update profile" });
  }
});

// GET /reviews — List reviews of this seller
router.get("/reviews", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireSeller(req, res)) return;

    const seller = await prisma.seller.findUnique({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    if (!seller) {
      return res.status(404).json({ error: "Seller account not found" });
    }

    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      prisma.sellerReview.findMany({
        where: { sellerId: seller.id },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.sellerReview.count({ where: { sellerId: seller.id } }),
    ]);

    return res.json({
      reviews,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("List reviews error:", error);
    return res.status(500).json({ error: "Failed to load reviews" });
  }
});

// POST /upload-images — Upload product images (max 10 files)
router.post("/upload-images", authenticate, uploadMultiple, validateUploadedFiles, async (req: AuthRequest, res: Response) => {
  try {
    if (!requireSeller(req, res)) return;

    const seller = await prisma.seller.findUnique({
      where: { userId: req.user!.id },
      select: { id: true, status: true },
    });
    if (!seller) {
      return res.status(404).json({ error: "Seller account not found" });
    }
    if (seller.status !== "APPROVED") {
      return res.status(403).json({ error: "Seller account is not approved" });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const urls = files.map((f) => `/uploads/${f.filename}`);
    return res.json({ urls });
  } catch (error) {
    console.error("Upload images error:", error);
    return res.status(500).json({ error: "Failed to upload images" });
  }
});

export default router;
