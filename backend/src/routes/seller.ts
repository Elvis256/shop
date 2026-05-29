import { Router, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { uploadMultiple, validateUploadedFiles } from "../middleware/upload";
import { logActivity } from "../lib/activityLogger";

const router = Router();

// Extend AuthRequest to carry seller data
interface SellerRequest extends AuthRequest {
  seller?: any;
}

// Async middleware: checks for an approved Seller record linked to the authenticated user.
// Attaches full req.seller for downstream use. No role check — any user with an approved Seller record qualifies.
async function requireSeller(req: SellerRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const seller = await prisma.seller.findUnique({
    where: { userId: req.user.id },
  });
  if (!seller || seller.status !== "APPROVED") {
    return res.status(403).json({
      error: seller?.status === "PENDING"
        ? "Your seller application is still under review"
        : "Seller access required",
    });
  }
  req.seller = seller;
  next();
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

export async function getCommissionRate(sellerId: string, categoryId: string | null): Promise<number> {
  // 1. Try category-specific rule
  if (categoryId) {
    const categoryRule = await prisma.commissionRule.findUnique({
      where: { categoryId },
    });
    if (categoryRule && !categoryRule.isActive) return 15; // inactive rule, use default
    if (categoryRule) return Number(categoryRule.rate);
  }

  // 2. Try seller-specific override
  const seller = await prisma.seller.findUnique({
    where: { id: sellerId },
    select: { commissionRate: true, tier: true },
  });
  if (seller?.commissionRate !== null && seller?.commissionRate !== undefined) {
    return Number(seller.commissionRate);
  }

  // 2b. Tier-based rate (GOLD=10%, SILVER=12%, BRONZE falls through to default)
  if (seller?.tier === "GOLD") return 10;
  if (seller?.tier === "SILVER") return 12;

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

    // Note: we do NOT change user.role — the Seller record is the seller flag.
    // The user keeps their original role (CUSTOMER/ADMIN) and gains seller access additively.

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
router.get("/dashboard", authenticate, requireSeller, async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;

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

    const topProductsFormatted = topProducts.map((tp) => {
      const product = topProductDetails.find((p) => p.id === tp.productId);
      const unitsSold = tp._sum?.quantity || 0;
      return {
        name: product?.name || "Unknown",
        unitsSold,
        revenue: unitsSold * Number(product?.price || 0),
      };
    });

    // Format recent orders for frontend
    const formattedOrders = recentOrders.map((item) => ({
      id: item.order.id,
      orderNumber: item.order.orderNumber,
      customerName: item.order.customerName || "Customer",
      items: item.quantity,
      total: Number(item.price) * item.quantity,
      status: item.order.status,
      createdAt: item.order.createdAt,
    }));

    return res.json({
      totalProducts,
      activeProducts,
      totalOrders,
      totalEarnings: seller.totalEarnings,
      balance: seller.balance,
      totalSales: seller.totalSales,
      tier: seller.tier,
      status: seller.status,
      rating: seller.rating,
      reviewCount: seller.reviewCount,
      recentOrders: formattedOrders,
      topProducts: topProductsFormatted,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return res.status(500).json({ error: "Failed to load dashboard" });
  }
});

// GET /products — List seller's own products
router.get("/products", authenticate, requireSeller, async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;

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
    if (status && ["DRAFT", "ACTIVE", "ARCHIVED", "PENDING_REVIEW"].includes(status)) {
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

// GET /products/:id — Get single product details for editing
router.get("/products/:id", authenticate, requireSeller, async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;

    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        images: true,
        category: { select: { id: true, name: true } },
      },
    });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    if (product.sellerId !== seller.id) {
      return res.status(403).json({ error: "You can only view your own products" });
    }

    return res.json({ product });
  } catch (error) {
    console.error("Get seller product error:", error);
    return res.status(500).json({ error: "Failed to load product" });
  }
});

// POST /products — Create a product as seller
router.post("/products", authenticate, requireSeller, async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;

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
    let productStatus: "DRAFT" | "ACTIVE" | "PENDING_REVIEW" = "ACTIVE";
    if (!seller.autoApproveProducts) {
      productStatus = "PENDING_REVIEW";
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

    logActivity({
      userId: seller.userId,
      action: "PRODUCT_CREATED",
      entityType: "Seller",
      entityId: seller.id,
      description: `Created product "${name.trim()}" (${productStatus})`,
    });

    return res.status(201).json({ product });
  } catch (error) {
    console.error("Create product error:", error);
    return res.status(500).json({ error: "Failed to create product" });
  }
});

// PUT /products/:id — Update own product
router.put("/products/:id", authenticate, requireSeller, async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;

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
      if (status === "ACTIVE" && !seller.autoApproveProducts) {
        data.status = "PENDING_REVIEW";
      } else {
        data.status = status;
      }
    }

    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data,
      include: {
        images: true,
        category: { select: { id: true, name: true } },
      },
    });

    logActivity({
      userId: seller.userId,
      action: "PRODUCT_UPDATED",
      entityType: "Seller",
      entityId: seller.id,
      description: `Updated product "${updated.name}"`,
    });

    return res.json({ product: updated });
  } catch (error) {
    console.error("Update product error:", error);
    return res.status(500).json({ error: "Failed to update product" });
  }
});

// DELETE /products/:id — Soft delete (set to DRAFT)
router.delete("/products/:id", authenticate, requireSeller, async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;

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
router.get("/orders", authenticate, requireSeller, async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;

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
    const search = (req.query.search as string)?.trim();
    if (search) {
      orderWhere.OR = [
        { orderNumber: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
      ];
    }
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;
    if (dateFrom || dateTo) {
      orderWhere.createdAt = {};
      if (dateFrom) orderWhere.createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setDate(to.getDate() + 1);
        orderWhere.createdAt.lte = to;
      }
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
router.get("/orders/:id", authenticate, requireSeller, async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;

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
router.put("/orders/:id/status", authenticate, requireSeller, async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;

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
router.get("/earnings", authenticate, requireSeller, async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;

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

    // Compute commission and net for each item
    const commissionRate = seller.commissionRate !== null ? Number(seller.commissionRate) : 15;
    const recentTransactions = recentItems.map((item) => {
      const amount = Number(item.price) * item.quantity;
      const commission = Math.round((amount * commissionRate) / 100);
      return {
        id: item.id,
        orderNumber: item.order.orderNumber,
        productName: item.product?.name || "Unknown Product",
        amount,
        commission,
        net: amount - commission,
        date: item.order.createdAt,
      };
    });

    return res.json({
      totalEarnings: seller.totalEarnings,
      balance: seller.balance,
      totalWithdrawn: totalWithdrawn._sum.amount || 0,
      pendingPayouts: pendingPayouts._sum.amount || 0,
      recentTransactions,
    });
  } catch (error) {
    console.error("Earnings error:", error);
    return res.status(500).json({ error: "Failed to load earnings" });
  }
});

// POST /payouts/request — Request a payout
router.post("/payouts/request", authenticate, requireSeller, async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;

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
router.get("/payouts", authenticate, requireSeller, async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;

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

// GET /profile — Get seller's own profile for settings
router.get("/profile", authenticate, requireSeller, async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;

    return res.json({ seller });
  } catch (error) {
    console.error("Get seller profile error:", error);
    return res.status(500).json({ error: "Failed to load profile" });
  }
});

// PUT /profile — Update seller profile
router.put("/profile", authenticate, requireSeller, async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;

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
router.get("/reviews", authenticate, requireSeller, async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;

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
router.post("/upload-images", authenticate, requireSeller, uploadMultiple, validateUploadedFiles, async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;

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

// ============ SELLER RETURNS ============

// GET /returns — List return requests for orders containing this seller's items
router.get("/returns", authenticate, requireSeller, async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;

    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const status = req.query.status as string;

    // Find order IDs that have items belonging to this seller
    const sellerOrderItems = await prisma.orderItem.findMany({
      where: { sellerId: seller.id },
      select: { orderId: true, id: true },
    });
    const orderIds = [...new Set(sellerOrderItems.map((oi) => oi.orderId))];

    if (orderIds.length === 0) {
      return res.json({ returns: [], pagination: { page, limit, total: 0, pages: 0 } });
    }

    const where: any = { orderId: { in: orderIds } };
    if (status && ["PENDING", "APPROVED", "REJECTED", "COMPLETED"].includes(status)) {
      where.status = status;
    }

    const [returns, total] = await Promise.all([
      prisma.returnRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          order: { select: { id: true, orderNumber: true, customerName: true } },
          items: true,
        },
      }),
      prisma.returnRequest.count({ where }),
    ]);

    return res.json({
      returns,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("List seller returns error:", error);
    return res.status(500).json({ error: "Failed to load returns" });
  }
});

// PUT /returns/:id — Seller adds notes to a return request
router.put("/returns/:id", authenticate, requireSeller, async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;

    const returnRequest = await prisma.returnRequest.findUnique({
      where: { id: req.params.id },
      include: { order: { select: { id: true } } },
    });
    if (!returnRequest) return res.status(404).json({ error: "Return request not found" });

    // Verify seller has items in this order
    const sellerItems = await prisma.orderItem.findMany({
      where: { orderId: returnRequest.orderId, sellerId: seller.id },
    });
    if (sellerItems.length === 0) {
      return res.status(403).json({ error: "Not authorized for this return request" });
    }

    const { sellerNotes, status, rejectionReason } = req.body;
    const data: any = {};
    if (sellerNotes !== undefined) data.sellerNotes = sellerNotes?.trim() || null;

    if (status && ["APPROVED", "REJECTED"].includes(status)) {
      if (returnRequest.status !== "PENDING") {
        return res.status(400).json({ error: "Can only approve/reject pending returns" });
      }
      data.status = status;
      if (status === "REJECTED" && rejectionReason) {
        data.sellerNotes = (data.sellerNotes || "") + (data.sellerNotes ? "\n" : "") + `Rejection reason: ${rejectionReason.trim()}`;
      }
    }

    const updated = await prisma.returnRequest.update({
      where: { id: req.params.id },
      data,
    });

    return res.json({ returnRequest: updated });
  } catch (error) {
    console.error("Update seller return error:", error);
    return res.status(500).json({ error: "Failed to update return request" });
  }
});

// ============ SELLER ANALYTICS ============

// GET /analytics — Seller analytics dashboard data
router.get("/analytics", authenticate, requireSeller, async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;

    const period = Math.min(parseInt(req.query.period as string) || 30, 365);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    // Get seller's product IDs
    const sellerProducts = await prisma.product.findMany({
      where: { sellerId: seller.id },
      select: { id: true, name: true, categoryId: true },
    });
    const productIds = sellerProducts.map((p) => p.id);

    // Order items in period with CONFIRMED+ orders
    const orderItems = await prisma.orderItem.findMany({
      where: {
        sellerId: seller.id,
        order: {
          createdAt: { gte: startDate },
          status: { in: ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] },
        },
      },
      include: {
        order: { select: { createdAt: true, shippingAddress: true } },
        product: { select: { id: true, name: true, categoryId: true, category: { select: { name: true } } } },
      },
    });

    // Summary
    const totalRevenue = orderItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
    const totalUnitsSold = orderItems.reduce((sum, item) => sum + item.quantity, 0);

    // Views
    const totalViews = productIds.length > 0
      ? await prisma.browseEvent.count({
          where: { productId: { in: productIds }, viewedAt: { gte: startDate } },
        })
      : 0;

    const orderCount = new Set(orderItems.map((i) => i.orderId)).size;
    const conversionRate = totalViews > 0 ? Math.round((orderCount / totalViews) * 10000) / 100 : 0;

    // Sales trend (daily)
    const dailyMap: Record<string, { revenue: number; orders: Set<string> }> = {};
    for (const item of orderItems) {
      const dateKey = item.order.createdAt.toISOString().slice(0, 10);
      if (!dailyMap[dateKey]) dailyMap[dateKey] = { revenue: 0, orders: new Set() };
      dailyMap[dateKey].revenue += Number(item.price) * item.quantity;
      dailyMap[dateKey].orders.add(item.orderId);
    }

    const salesTrend = [];
    for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      salesTrend.push({
        date: key,
        revenue: dailyMap[key]?.revenue || 0,
        orders: dailyMap[key]?.orders.size || 0,
      });
    }

    // Top products
    const productRevenueMap: Record<string, { name: string; revenue: number; unitsSold: number }> = {};
    for (const item of orderItems) {
      const pid = item.productId;
      if (!productRevenueMap[pid]) {
        productRevenueMap[pid] = { name: item.product?.name || "Unknown", revenue: 0, unitsSold: 0 };
      }
      productRevenueMap[pid].revenue += Number(item.price) * item.quantity;
      productRevenueMap[pid].unitsSold += item.quantity;
    }
    const topProducts = Object.values(productRevenueMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Revenue by category
    const categoryMap: Record<string, { name: string; revenue: number }> = {};
    for (const item of orderItems) {
      const catName = item.product?.category?.name || "Uncategorized";
      if (!categoryMap[catName]) categoryMap[catName] = { name: catName, revenue: 0 };
      categoryMap[catName].revenue += Number(item.price) * item.quantity;
    }
    const revenueByCategory = Object.values(categoryMap).sort((a, b) => b.revenue - a.revenue);

    // Customer geography (parse city from shippingAddress JSON)
    const cityMap: Record<string, number> = {};
    for (const item of orderItems) {
      try {
        const addr = typeof item.order.shippingAddress === "string"
          ? JSON.parse(item.order.shippingAddress)
          : item.order.shippingAddress;
        const city = addr?.city || "Unknown";
        cityMap[city] = (cityMap[city] || 0) + 1;
      } catch {
        cityMap["Unknown"] = (cityMap["Unknown"] || 0) + 1;
      }
    }
    const customerGeography = Object.entries(cityMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return res.json({
      summary: { totalRevenue, totalUnitsSold, totalViews, conversionRate },
      salesTrend,
      topProducts,
      revenueByCategory,
      customerGeography,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return res.status(500).json({ error: "Failed to load analytics" });
  }
});

// ============ SELLER REVIEWS ============

// GET /product-reviews — List reviews for seller's products
router.get("/product-reviews", authenticate, requireSeller, async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const rating = parseInt(req.query.rating as string) || 0;
    const search = (req.query.search as string)?.trim();

    const productIds = (
      await prisma.product.findMany({
        where: { sellerId: seller.id },
        select: { id: true },
      })
    ).map((p) => p.id);

    if (productIds.length === 0) {
      return res.json({ reviews: [], pagination: { page, limit, total: 0, pages: 0 } });
    }

    const where: any = { productId: { in: productIds } };
    if (rating >= 1 && rating <= 5) where.rating = rating;
    if (search) {
      where.product = { name: { contains: search, mode: "insensitive" } };
    }

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          product: { select: { id: true, name: true, slug: true, images: { take: 1, select: { url: true } } } },
          user: { select: { id: true, name: true } },
          images: { select: { id: true, url: true } },
        },
      }),
      prisma.review.count({ where }),
    ]);

    return res.json({
      reviews,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("List seller reviews error:", error);
    return res.status(500).json({ error: "Failed to load reviews" });
  }
});

// POST /product-reviews/:id/reply — Seller replies to a review
router.post("/product-reviews/:id/reply", authenticate, requireSeller, async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;
    const { reply } = req.body;

    if (!reply || typeof reply !== "string" || reply.trim().length === 0) {
      return res.status(400).json({ error: "Reply text is required" });
    }

    const review = await prisma.review.findUnique({
      where: { id: req.params.id },
      include: { product: { select: { sellerId: true } } },
    });

    if (!review) return res.status(404).json({ error: "Review not found" });
    if (review.product.sellerId !== seller.id) {
      return res.status(403).json({ error: "You can only reply to reviews on your products" });
    }

    const updated = await prisma.review.update({
      where: { id: req.params.id },
      data: {
        sellerReply: reply.trim(),
        sellerRepliedAt: new Date(),
      },
    });

    return res.json({ review: updated });
  } catch (error) {
    console.error("Reply to review error:", error);
    return res.status(500).json({ error: "Failed to reply to review" });
  }
});

// ============ SELLER BULK OPERATIONS ============

// PUT /products/bulk — Bulk activate/deactivate/delete products
router.put("/products/bulk", authenticate, requireSeller, async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;
    const { action, productIds } = req.body;

    if (!action || !["activate", "deactivate", "delete"].includes(action)) {
      return res.status(400).json({ error: "Invalid action. Use: activate, deactivate, delete" });
    }
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: "Product IDs are required" });
    }

    // Verify all products belong to seller
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, sellerId: seller.id },
      select: { id: true },
    });
    if (products.length !== productIds.length) {
      return res.status(403).json({ error: "Some products do not belong to you" });
    }

    const statusMap: Record<string, "ACTIVE" | "DRAFT"> = {
      activate: "ACTIVE",
      deactivate: "DRAFT",
      delete: "DRAFT",
    };

    await prisma.product.updateMany({
      where: { id: { in: productIds }, sellerId: seller.id },
      data: { status: statusMap[action] },
    });

    return res.json({ message: `${products.length} products ${action}d successfully` });
  } catch (error) {
    console.error("Bulk product operation error:", error);
    return res.status(500).json({ error: "Failed to perform bulk operation" });
  }
});

// ============ SELLER NOTIFICATIONS ============

// GET /notifications — Virtual notifications from recent activity
router.get("/notifications", authenticate, requireSeller, async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const productIds = (
      await prisma.product.findMany({
        where: { sellerId: seller.id },
        select: { id: true, name: true, stock: true },
      })
    );
    const pIds = productIds.map((p) => p.id);

    const [newOrders, newReviews, newReturns, recentPayouts] = await Promise.all([
      prisma.orderItem.findMany({
        where: { sellerId: seller.id, order: { createdAt: { gte: since } } },
        include: { order: { select: { id: true, orderNumber: true, createdAt: true, totalAmount: true } } },
        distinct: ["orderId"],
        orderBy: { order: { createdAt: "desc" } },
        take: 10,
      }),
      pIds.length > 0
        ? prisma.review.findMany({
            where: { productId: { in: pIds }, createdAt: { gte: since } },
            include: { product: { select: { name: true } } },
            orderBy: { createdAt: "desc" },
            take: 5,
          })
        : [],
      prisma.returnRequest.findMany({
        where: {
          order: { items: { some: { sellerId: seller.id } } },
          createdAt: { gte: since },
        },
        include: { order: { select: { orderNumber: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.sellerPayout.findMany({
        where: { sellerId: seller.id, createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    const notifications: Array<{
      type: string;
      message: string;
      detail?: string;
      time: string;
      link?: string;
    }> = [];

    for (const oi of newOrders) {
      notifications.push({
        type: "order",
        message: `New order ${oi.order.orderNumber}`,
        detail: `UGX ${Number(oi.order.totalAmount).toLocaleString()}`,
        time: oi.order.createdAt.toISOString(),
        link: "/seller/orders",
      });
    }

    for (const review of newReviews) {
      notifications.push({
        type: "review",
        message: `New ${review.rating}-star review on ${review.product.name}`,
        time: review.createdAt.toISOString(),
        link: "/seller/reviews",
      });
    }

    for (const ret of newReturns) {
      notifications.push({
        type: "return",
        message: `Return request for order ${ret.order.orderNumber}`,
        time: ret.createdAt.toISOString(),
        link: "/seller/returns",
      });
    }

    for (const p of productIds) {
      if (p.stock <= 5 && p.stock > 0) {
        notifications.push({
          type: "low_stock",
          message: `Low stock: ${p.name} (${p.stock} left)`,
          time: new Date().toISOString(),
          link: "/seller/products",
        });
      }
    }

    for (const payout of recentPayouts) {
      notifications.push({
        type: "payout",
        message: `Payout ${payout.status.toLowerCase()}: UGX ${Number(payout.amount).toLocaleString()}`,
        time: payout.createdAt.toISOString(),
        link: "/seller/earnings",
      });
    }

    // Sort by time descending
    notifications.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    return res.json({ notifications: notifications.slice(0, 20) });
  } catch (error) {
    console.error("Seller notifications error:", error);
    return res.status(500).json({ error: "Failed to load notifications" });
  }
});

// ============ WARNINGS ============

// GET /warnings — Seller's own warnings
router.get("/warnings", authenticate, requireSeller, async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;
    const warnings = await prisma.sellerWarning.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ warnings });
  } catch (error) {
    console.error("List seller warnings error:", error);
    return res.status(500).json({ error: "Failed to load warnings" });
  }
});

// PUT /warnings/:id/acknowledge — Acknowledge a warning
router.put("/warnings/:id/acknowledge", authenticate, requireSeller, async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;
    const warning = await prisma.sellerWarning.findUnique({
      where: { id: req.params.id },
    });
    if (!warning || warning.sellerId !== seller.id) {
      return res.status(404).json({ error: "Warning not found" });
    }
    if (warning.acknowledgedAt) {
      return res.json({ warning });
    }
    const updated = await prisma.sellerWarning.update({
      where: { id: req.params.id },
      data: { acknowledgedAt: new Date() },
    });
    return res.json({ warning: updated });
  } catch (error) {
    console.error("Acknowledge warning error:", error);
    return res.status(500).json({ error: "Failed to acknowledge warning" });
  }
});

// ============ SCORECARD ============

// GET /scorecard — Seller's own performance scorecard
router.get("/scorecard", authenticate, requireSeller, async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;

    const [totalItems, shippedDelivered, returnCount] = await Promise.all([
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
    ]);

    const fulfillmentRate = totalItems > 0 ? Math.round((shippedDelivered / totalItems) * 100) : 100;
    const returnRate = totalItems > 0 ? Math.round((returnCount / totalItems) * 100) : 0;
    const customerRating = Number(seller.rating);

    const flags: string[] = [];
    if (fulfillmentRate < 80) flags.push("Low fulfillment rate");
    if (customerRating < 3.0) flags.push("Low customer rating");
    if (returnRate > 10) flags.push("High return rate");

    return res.json({
      scorecard: {
        fulfillmentRate,
        returnRate,
        customerRating,
        totalOrders: totalItems,
        flags,
      },
    });
  } catch (error) {
    console.error("Seller scorecard error:", error);
    return res.status(500).json({ error: "Failed to load scorecard" });
  }
});

// ============ SELLER CHAT ============

// GET /chat/conversations — List conversations for this seller
router.get("/chat/conversations", authenticate, requireSeller, async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;

    const conversations = await prisma.conversation.findMany({
      where: { sellerId: seller.id },
      orderBy: { lastMessageAt: "desc" },
      include: {
        buyer: { select: { id: true, name: true, email: true } },
        product: { select: { id: true, name: true, slug: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    // Get unread counts
    const result = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await prisma.chatMessage.count({
          where: { conversationId: conv.id, senderType: { in: ["BUYER", "ADMIN"] }, isRead: false },
        });
        return {
          ...conv,
          lastMessage: conv.messages[0] || null,
          unreadCount,
          messages: undefined,
        };
      })
    );

    return res.json({ conversations: result });
  } catch (error) {
    console.error("List seller conversations error:", error);
    return res.status(500).json({ error: "Failed to load conversations" });
  }
});

// GET /chat/:id/messages — Get messages for a conversation (seller side)
router.get("/chat/:id/messages", authenticate, requireSeller, async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;

    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: {
        buyer: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!conversation || conversation.sellerId !== seller.id) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const messages = await prisma.chatMessage.findMany({
      where: { conversationId: req.params.id },
      orderBy: { createdAt: "asc" },
    });

    // Mark buyer and admin messages as read
    await prisma.chatMessage.updateMany({
      where: { conversationId: req.params.id, senderType: { in: ["BUYER", "ADMIN"] }, isRead: false },
      data: { isRead: true },
    });

    return res.json({ conversation, messages });
  } catch (error) {
    console.error("Get seller messages error:", error);
    return res.status(500).json({ error: "Failed to load messages" });
  }
});

// POST /chat/:id/messages — Send message as seller
router.post("/chat/:id/messages", authenticate, requireSeller, async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;

    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
    });
    if (!conversation || conversation.sellerId !== seller.id) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const { message } = req.body;
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ error: "Message is required" });
    }

    const [chatMessage] = await prisma.$transaction([
      prisma.chatMessage.create({
        data: {
          conversationId: req.params.id,
          senderId: seller.id,
          senderType: "SELLER",
          message: message.trim(),
        },
      }),
      prisma.conversation.update({
        where: { id: req.params.id },
        data: { lastMessageAt: new Date() },
      }),
    ]);

    return res.status(201).json({ message: chatMessage });
  } catch (error) {
    console.error("Send seller message error:", error);
    return res.status(500).json({ error: "Failed to send message" });
  }
});

// GET /api/seller/onboarding-status
router.get("/onboarding-status", authenticate, requireSeller, async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller;

    const productCount = await prisma.product.count({ where: { sellerId: seller.id } });

    const steps = [
      {
        key: "logo",
        label: "Upload your store logo",
        completed: !!seller.logo,
        link: "/seller/settings",
      },
      {
        key: "description",
        label: "Add a store description (20+ characters)",
        completed: !!seller.description && seller.description.length > 20,
        link: "/seller/settings",
      },
      {
        key: "product",
        label: "Add your first product",
        completed: productCount >= 1,
        link: "/seller/products",
      },
      {
        key: "payout",
        label: "Set up your payout method",
        completed: !!seller.payoutMethod && (!!seller.payoutPhone || !!seller.bankAccount),
        link: "/seller/settings",
      },
    ];

    const completedCount = steps.filter((s) => s.completed).length;
    const progress = Math.round((completedCount / steps.length) * 100);
    const isComplete = completedCount === steps.length;

    // Auto-set onboardingCompleted when all steps done
    if (isComplete && !seller.onboardingCompleted) {
      await prisma.seller.update({
        where: { id: seller.id },
        data: { onboardingCompleted: true },
      });
    }

    return res.json({ steps, progress, isComplete });
  } catch (error) {
    console.error("Onboarding status error:", error);
    return res.status(500).json({ error: "Failed to fetch onboarding status" });
  }
});

export default router;
