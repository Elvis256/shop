import { Router, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { uploadMultiple, validateUploadedFiles, uploadDocuments, validateUploadedDocuments } from "../middleware/upload";
import { logActivity } from "../lib/activityLogger";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";
import { createFlutterwaveTransfer } from "../services/flutterwave";
import { sendWhatsApp } from "../services/whatsapp";
import { sendSMS } from "../services/sms";
import { enqueueNotification } from "../services/notificationDispatcher";
import { parseShippingAddress } from "../utils/shippingAddress";
import crypto from "crypto";

const router = Router();

// Extend AuthRequest to carry seller data
interface SellerRequest extends AuthRequest {
  seller?: any;
}

async function requireSeller(req: SellerRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const seller = await prisma.seller.findUnique({
    where: { userId: req.user.id },
  });
  if (!seller) {
    return res.status(403).json({ error: "Seller access required" });
  }

  if (seller.status !== "APPROVED") {
    // Allow pending sellers to complete onboarding steps
    const allowedPendingPaths = [
      "/profile",
      "/upload-images",
      "/upload-documents",
      "/products",
    ];
    const isAllowed = allowedPendingPaths.some(
      (path) => req.path === path || req.path.startsWith(path + "/")
    );

    if (seller.status === "PENDING" && isAllowed) {
      // Allowed through to complete onboarding
    } else {
      return res.status(403).json({
        error: seller.status === "PENDING"
          ? "Your seller application is still under review"
          : "Seller access required",
      });
    }
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

function sanitizeInput(str: any): string | null {
  if (str === null || str === undefined) return null;
  if (typeof str !== "string") return String(str);
  return str
    .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "")
    .replace(/<[^>]*>?/gm, "")
    .trim();
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

// Batched version — resolves commission rates for multiple items in 2-3 queries total
export async function getCommissionRates(
  items: Array<{ sellerId: string; categoryId: string | null }>
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const uniqueCategoryIds = [...new Set(items.map((i) => i.categoryId).filter(Boolean))] as string[];
  const uniqueSellerIds = [...new Set(items.map((i) => i.sellerId))];

  // Batch 1: all category rules
  const categoryRules = uniqueCategoryIds.length > 0
    ? await prisma.commissionRule.findMany({ where: { categoryId: { in: uniqueCategoryIds } } })
    : [];
  const catRuleMap = new Map(categoryRules.map((r) => [r.categoryId, r]));

  // Batch 2: all sellers
  const sellers = await prisma.seller.findMany({
    where: { id: { in: uniqueSellerIds } },
    select: { id: true, commissionRate: true, tier: true },
  });
  const sellerMap = new Map(sellers.map((s) => [s.id, s]));

  // Batch 3: default rule (single query)
  const defaultRule = await prisma.commissionRule.findFirst({
    where: { categoryId: null, isActive: true },
  });

  for (const item of items) {
    const key = `${item.sellerId}:${item.categoryId || ""}`;
    if (result.has(key)) continue;

    // Same logic as getCommissionRate but using cached data
    if (item.categoryId) {
      const catRule = catRuleMap.get(item.categoryId);
      if (catRule && !catRule.isActive) { result.set(key, 15); continue; }
      if (catRule) { result.set(key, Number(catRule.rate)); continue; }
    }
    const seller = sellerMap.get(item.sellerId);
    if (seller?.commissionRate !== null && seller?.commissionRate !== undefined) {
      result.set(key, Number(seller.commissionRate)); continue;
    }
    if (seller?.tier === "GOLD") { result.set(key, 10); continue; }
    if (seller?.tier === "SILVER") { result.set(key, 12); continue; }
    if (defaultRule) { result.set(key, Number(defaultRule.rate)); continue; }
    result.set(key, 15);
  }
  return result;
}

// ============ PUBLIC ROUTES ============

// POST /register — Register as a seller
router.post("/register", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
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
    logger.error("Seller registration error", { error });
    return res.status(500).json({ error: "Failed to register as seller" });
  }
}));

// GET /stores — Public: browse all approved stores
router.get("/stores", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { search, page = "1", limit = "20" } = req.query;
    const take = Math.min(parseInt(limit as string) || 20, 50);
    const skip = (Math.max(parseInt(page as string) || 1, 1) - 1) * take;

    const where: any = { status: "APPROVED" };
    if (search) {
      where.OR = [
        { storeName: { contains: search as string, mode: "insensitive" } },
        { description: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const [stores, total] = await Promise.all([
      prisma.seller.findMany({
        where,
        select: {
          id: true, storeName: true, storeSlug: true, logo: true,
          description: true, rating: true, reviewCount: true, tier: true,
          _count: { select: { products: { where: { status: "ACTIVE" } } } },
        },
        orderBy: { rating: "desc" },
        take,
        skip,
      }),
      prisma.seller.count({ where }),
    ]);

    return res.json({
      stores: stores.map((s: any) => ({
        ...s, productCount: s._count.products, _count: undefined,
      })),
      pagination: { total, page: Math.floor(skip / take) + 1, totalPages: Math.ceil(total / take) },
    });
  } catch (error) {
    logger.error("Browse stores error", { error });
    return res.status(500).json({ error: "Failed to fetch stores" });
  }
}));

// GET /store/:slug — Public seller profile
router.get("/store/:slug", asyncHandler(async (req: AuthRequest, res: Response) => {
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
        tier: true,
        trustScore: true,
        totalSales: true,
        createdAt: true,
        status: true,
        badges: {
          where: { isActive: true },
          select: { badge: true, earnedAt: true },
        },
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
    logger.error("Get store error", { error });
    return res.status(500).json({ error: "Failed to load store" });
  }
}));

// GET /store/:slug/products — Public seller product listing
router.get("/store/:slug/products", asyncHandler(async (req: AuthRequest, res: Response) => {
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
    logger.error("Get store products error", { error });
    return res.status(500).json({ error: "Failed to load store products" });
  }
}));

// GET /store/:slug/reviews — Public seller reviews
router.get("/store/:slug/reviews", asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const skip = (page - 1) * limit;

    const seller = await prisma.seller.findUnique({
      where: { storeSlug: slug },
      select: { id: true, status: true },
    });

    if (!seller || seller.status !== "APPROVED") {
      return res.status(404).json({ error: "Store not found" });
    }

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
    logger.error("Get store reviews error", { error });
    return res.status(500).json({ error: "Failed to load reviews" });
  }
}));

// POST /store/:slug/reviews — Submit a review for a seller (authenticated)
router.post("/store/:slug/reviews", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const user = req.user!;
    const { rating, comment, orderId } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    const seller = await prisma.seller.findUnique({
      where: { storeSlug: slug },
      select: { id: true, status: true, userId: true },
    });

    if (!seller || seller.status !== "APPROVED") {
      return res.status(404).json({ error: "Store not found" });
    }

    // Cannot review your own store
    if (seller.userId === user.id) {
      return res.status(400).json({ error: "Cannot review your own store" });
    }

    // Verify the user has ordered from this seller (if orderId provided)
    if (orderId) {
      const orderItem = await prisma.orderItem.findFirst({
        where: { sellerId: seller.id, order: { userId: user.id, id: orderId, status: "DELIVERED" } },
      });
      if (!orderItem) {
        return res.status(400).json({ error: "You can only review after a delivered order" });
      }
    }

    const userName = (await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } }))?.name || "Anonymous";

    const review = await prisma.sellerReview.create({
      data: {
        sellerId: seller.id,
        userId: user.id,
        userName,
        rating: Math.round(rating),
        comment: comment?.slice(0, 2000) || null,
        orderId: orderId || null,
      },
    });

    // Update seller rating aggregate
    const agg = await prisma.sellerReview.aggregate({
      where: { sellerId: seller.id },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await prisma.seller.update({
      where: { id: seller.id },
      data: {
        rating: agg._avg.rating || 0,
        reviewCount: agg._count.rating || 0,
      },
    });

    return res.status(201).json({ review });
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(400).json({ error: "You have already reviewed this seller for this order" });
    }
    logger.error("Submit store review error", { error });
    return res.status(500).json({ error: "Failed to submit review" });
  }
}));

// ============ SELLER AUTHENTICATED ROUTES ============

// GET /dashboard — Seller dashboard stats
router.get("/dashboard", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
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
    logger.error("Dashboard error", { error });
    return res.status(500).json({ error: "Failed to load dashboard" });
  }
}));

// GET /products — List seller's own products
router.get("/products", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
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
          variants: { select: { id: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return res.json({
      products: products.map((p) => ({ ...p, hasVariants: p.hasVariants, variants: p.variants })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error("List seller products error", { error });
    return res.status(500).json({ error: "Failed to load products" });
  }
}));

// GET /products/export — Export all products as CSV
router.get("/products/export", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;
    const products = await prisma.product.findMany({
      where: { sellerId: seller.id },
      include: { category: { select: { name: true } }, images: { take: 1 } },
      orderBy: { createdAt: "desc" },
    });

    const headers = ["name", "description", "price", "comparePrice", "stock", "sku", "category", "tags", "status", "weight", "metaTitle", "metaDescription"];
    const rows = products.map((p) => [
      p.name,
      (p.description || "").replace(/"/g, '""'),
      Number(p.price),
      p.comparePrice ? Number(p.comparePrice) : "",
      p.stock,
      p.sku || "",
      p.category?.name || "",
      (p.tags || []).join("|"),
      p.status,
      p.weight ? Number(p.weight) : "",
      p.metaTitle || "",
      p.metaDescription || "",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
    return res.json({ csv });
  } catch (error) {
    logger.error("Export products error", { error });
    return res.status(500).json({ error: "Failed to export products" });
  }
}));

// POST /products/import — Import products from CSV
router.post("/products/import", authenticate, requireSeller, uploadMultiple, asyncHandler(async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;
    const file = (req as any).files?.[0] || (req as any).file;
    if (!file) {
      return res.status(400).json({ error: "CSV file is required" });
    }

    const content = file.buffer?.toString("utf-8") || "";
    const lines = content.split("\n").filter((l: string) => l.trim());
    if (lines.length < 2) {
      return res.status(400).json({ error: "CSV must have at least a header and one data row" });
    }

    const headers = lines[0].split(",").map((h: string) => h.trim().replace(/^"|"$/g, "").toLowerCase());
    const nameIdx = headers.indexOf("name");
    const priceIdx = headers.indexOf("price");
    if (nameIdx === -1 || priceIdx === -1) {
      return res.status(400).json({ error: "CSV must have 'name' and 'price' columns" });
    }

    const imported: string[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const vals = lines[i].split(",").map((v: string) => v.trim().replace(/^"|"$/g, ""));
        const name = vals[nameIdx];
        const price = parseFloat(vals[priceIdx]);
        if (!name || isNaN(price)) {
          errors.push(`Row ${i + 1}: Invalid name or price`);
          continue;
        }

        let slug = slugify(name);
        const slugExists = await prisma.product.findUnique({ where: { slug } });
        if (slugExists) slug = `${slug}-${Date.now().toString(36)}`;

        const descIdx = headers.indexOf("description");
        const stockIdx = headers.indexOf("stock");
        const skuIdx = headers.indexOf("sku");
        const tagsIdx = headers.indexOf("tags");
        const comparePriceIdx = headers.indexOf("compareprice");

        await prisma.product.create({
          data: {
            name,
            slug,
            description: descIdx >= 0 ? vals[descIdx] || null : null,
            price,
            comparePrice: comparePriceIdx >= 0 && vals[comparePriceIdx] ? parseFloat(vals[comparePriceIdx]) : null,
            stock: stockIdx >= 0 ? parseInt(vals[stockIdx]) || 0 : 0,
            sku: skuIdx >= 0 ? vals[skuIdx] || null : null,
            tags: tagsIdx >= 0 && vals[tagsIdx] ? vals[tagsIdx].split("|").map((t: string) => t.trim()) : [],
            sellerId: seller.id,
            status: seller.autoApproveProducts ? "ACTIVE" : "PENDING_REVIEW",
          },
        });
        imported.push(name);
      } catch (err: any) {
        errors.push(`Row ${i + 1}: ${err.message?.slice(0, 80) || "Unknown error"}`);
      }
    }

    return res.json({ imported: imported.length, errors });
  } catch (error) {
    logger.error("Import products error", { error });
    return res.status(500).json({ error: "Failed to import products" });
  }
}));

// PUT /products/bulk — Bulk activate/deactivate/delete products (must be before /products/:id)
router.put("/products/bulk", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;
    const { action, productIds } = req.body;

    if (!action || !["activate", "deactivate", "delete"].includes(action)) {
      return res.status(400).json({ error: "Invalid action. Use: activate, deactivate, delete" });
    }
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: "Product IDs are required" });
    }

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
    logger.error("Bulk product operation error", { error });
    return res.status(500).json({ error: "Failed to perform bulk operation" });
  }
}));

// GET /products/:id — Get single product details for editing
router.get("/products/:id", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;

    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        images: true,
        category: { select: { id: true, name: true } },
        variants: true,
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
    logger.error("Get seller product error", { error });
    return res.status(500).json({ error: "Failed to load product" });
  }
}));

// POST /products — Create a product as seller
router.post("/products", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
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
      hasVariants,
      variants,
      allowedDeliveryMethods,
      codAllowed,
      shippingFee,
    } = req.body;

    const sanitizedName = sanitizeInput(name) || "";
    if (!sanitizedName || sanitizedName.length < 2) {
      return res.status(400).json({ error: "Product name is required" });
    }
    if (price === undefined || isNaN(Number(price)) || Number(price) < 0) {
      return res.status(400).json({ error: "Valid price is required" });
    }

    // Generate slug
    let slug = slugify(sanitizedName);
    const slugExists = await prisma.product.findUnique({ where: { slug } });
    if (slugExists) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    // Determine product status
    let productStatus: "DRAFT" | "ACTIVE" | "PENDING_REVIEW" = "ACTIVE";
    if (!seller.autoApproveProducts) {
      productStatus = "PENDING_REVIEW";
    }

    const sanitizedSpecs = Array.isArray(specifications)
      ? specifications.map((s: any) => ({
          key: sanitizeInput(s.key) || "",
          value: sanitizeInput(s.value) || "",
        })).filter((s: any) => s.key && s.value)
      : null;

    const product = await prisma.product.create({
      data: {
        name: sanitizedName,
        slug,
        description: sanitizeInput(description),
        price: Number(price),
        comparePrice: comparePrice ? Number(comparePrice) : null,
        sku: sanitizeInput(sku),
        stock: parseInt(stock) || 0,
        categoryId: categoryId || null,
        tags: Array.isArray(tags) ? tags.map((t: any) => sanitizeInput(t)).filter(Boolean) : [],
        sellerId: seller.id,
        status: productStatus,
        weight: weight ? Number(weight) : null,
        specifications: sanitizedSpecs,
        metaTitle: sanitizeInput(metaTitle),
        metaDescription: sanitizeInput(metaDescription),
        trackInventory: trackInventory !== false,
        allowBackorder: allowBackorder === true,
        lowStockAlert: parseInt(lowStockAlert) || 5,
        hasVariants: hasVariants === true,
        allowedDeliveryMethods: Array.isArray(allowedDeliveryMethods) ? allowedDeliveryMethods : [],
        codAllowed: codAllowed !== false,
        shippingFee: shippingFee != null ? Number(shippingFee) : null,
        images: images?.length
          ? {
              create: images.map((img: { url: string; alt?: string }, idx: number) => ({
                url: img.url,
                alt: img.alt || sanitizedName,
                order: idx,
              })),
            }
          : undefined,
      },
      include: {
        images: true,
        category: { select: { id: true, name: true } },
        variants: true,
      },
    });

    // Create variants if provided
    if (hasVariants && Array.isArray(variants) && variants.length > 0) {
      await prisma.productVariant.createMany({
        data: variants.map((v: any) => ({
          productId: product.id,
          name: sanitizeInput(v.name) || "",
          sku: sanitizeInput(v.sku),
          price: v.price ? Number(v.price) : null,
          stock: parseInt(v.stock) || 0,
          size: sanitizeInput(v.size),
          color: sanitizeInput(v.color),
          material: sanitizeInput(v.material),
        })),
      });
    }

    logActivity({
      userId: seller.userId,
      action: "PRODUCT_CREATED",
      entityType: "Seller",
      entityId: seller.id,
      description: `Created product "${sanitizedName}" (${productStatus})`,
    });

    const result = await prisma.product.findUnique({
      where: { id: product.id },
      include: { images: true, category: { select: { id: true, name: true } }, variants: true },
    });

    return res.status(201).json({ product: result });
  } catch (error) {
    logger.error("Create product error", { error });
    return res.status(500).json({ error: "Failed to create product" });
  }
}));

// PUT /products/:id — Update own product
router.put("/products/:id", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
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
      hasVariants,
      variants,
      allowedDeliveryMethods,
      codAllowed,
      shippingFee,
    } = req.body;

    const data: any = {};
    if (name !== undefined) data.name = sanitizeInput(name);
    if (description !== undefined) data.description = sanitizeInput(description);
    if (price !== undefined) data.price = Number(price);
    if (comparePrice !== undefined) data.comparePrice = comparePrice ? Number(comparePrice) : null;
    if (sku !== undefined) data.sku = sanitizeInput(sku);
    if (stock !== undefined) data.stock = parseInt(stock) || 0;
    if (categoryId !== undefined) data.categoryId = categoryId || null;
    if (tags !== undefined) data.tags = Array.isArray(tags) ? tags.map((t: any) => sanitizeInput(t)).filter(Boolean) : [];
    if (weight !== undefined) data.weight = weight ? Number(weight) : null;
    if (specifications !== undefined) {
      data.specifications = Array.isArray(specifications)
        ? specifications.map((s: any) => ({
            key: sanitizeInput(s.key) || "",
            value: sanitizeInput(s.value) || "",
          })).filter((s: any) => s.key && s.value)
        : null;
    }
    if (metaTitle !== undefined) data.metaTitle = sanitizeInput(metaTitle);
    if (metaDescription !== undefined) data.metaDescription = sanitizeInput(metaDescription);
    if (trackInventory !== undefined) data.trackInventory = !!trackInventory;
    if (allowBackorder !== undefined) data.allowBackorder = !!allowBackorder;
    if (lowStockAlert !== undefined) data.lowStockAlert = parseInt(lowStockAlert) || 5;
    if (hasVariants !== undefined) data.hasVariants = !!hasVariants;
    if (allowedDeliveryMethods !== undefined) data.allowedDeliveryMethods = Array.isArray(allowedDeliveryMethods) ? allowedDeliveryMethods : [];
    if (codAllowed !== undefined) data.codAllowed = !!codAllowed;
    if (shippingFee !== undefined) data.shippingFee = shippingFee != null ? Number(shippingFee) : null;
    // Sellers can only set DRAFT or ACTIVE
    if (status !== undefined && ["DRAFT", "ACTIVE"].includes(status)) {
      if (status === "ACTIVE" && !seller.autoApproveProducts) {
        data.status = "PENDING_REVIEW";
      } else {
        data.status = status;
      }
    }

    // Handle variants update in a transaction
    if (Array.isArray(variants)) {
      await prisma.$transaction([
        prisma.productVariant.deleteMany({ where: { productId: req.params.id } }),
        ...(variants.length > 0
          ? [prisma.productVariant.createMany({
              data: variants.map((v: any) => ({
                productId: req.params.id,
                name: sanitizeInput(v.name) || "",
                sku: sanitizeInput(v.sku),
                price: v.price ? Number(v.price) : null,
                stock: parseInt(v.stock) || 0,
                size: sanitizeInput(v.size),
                color: sanitizeInput(v.color),
                material: sanitizeInput(v.material),
              })),
            })]
          : []),
      ]);
    }

    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data,
      include: {
        images: true,
        category: { select: { id: true, name: true } },
        variants: true,
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
    logger.error("Update product error", { error });
    return res.status(500).json({ error: "Failed to update product" });
  }
}));

// DELETE /products/:id — Soft delete (set to DRAFT)
router.delete("/products/:id", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
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
    logger.error("Delete product error", { error });
    return res.status(500).json({ error: "Failed to delete product" });
  }
}));

// GET /orders — List orders containing seller's items
router.get("/orders", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
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
    logger.error("List seller orders error", { error });
    return res.status(500).json({ error: "Failed to load orders" });
  }
}));

// GET /orders/:id — Single order detail for seller's items
router.get("/orders/:id", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
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
    logger.error("Get seller order error", { error });
    return res.status(500).json({ error: "Failed to load order" });
  }
}));

// PUT /orders/:id/status — Update fulfillment status for seller's items
router.put("/orders/:id/status", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
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

    // Check if this is a multi-seller order
    const totalItemCount = await prisma.orderItem.count({ where: { orderId: req.params.id } });
    const isMultiSeller = totalItemCount > sellerItems.length;

    // Always update the line-item statuses for this seller.
    await prisma.orderItem.updateMany({
      where: { orderId: req.params.id, sellerId: seller.id },
      data: { status },
    });

    if (isMultiSeller) {
      // Multi-seller order: add timeline event, but do NOT update global order status yet.
      await prisma.orderEvent.create({
        data: {
          orderId: req.params.id,
          status,
          note: `${seller.storeName}'s items: ${status}${trackingNumber ? ` (Tracking: ${trackingNumber.trim()})` : ""}`,
        },
      });

      // Orchestrator: if every item in the order is now SHIPPED, advance global status.
      if (status === "SHIPPED") {
        const pendingItems = await prisma.orderItem.count({
          where: { orderId: req.params.id, status: { not: "SHIPPED" } },
        });

        if (pendingItems === 0) {
          const order = await prisma.order.update({
            where: { id: req.params.id },
            data: { status: "SHIPPED" },
          });

          await prisma.orderEvent.create({
            data: {
              orderId: req.params.id,
              status: "SHIPPED",
              note: "All sellers have shipped their items — order marked as shipped",
            },
          });

          enqueueNotification({
            event: "ORDER_SHIPPED",
            recipientEmail: order.customerEmail || undefined,
            recipientPhone: order.customerPhone || undefined,
            recipientUserId: order.userId || undefined,
            orderId: order.id,
            data: {
              customerName: order.customerName,
              orderNumber: order.orderNumber,
              orderId: order.id,
              total: Number(order.totalAmount),
              currency: order.currency || "UGX",
              trackingNumber: trackingNumber || order.trackingNumber,
              estimatedDelivery: "2-3 business days",
            },
          }).catch((err) => logger.error("Notification dispatch failed", { error: err }));
        }
      }

      return res.json({ message: `Your items marked as ${status}`, multiSeller: true });
    }

    // Single-seller order: safe to update global order status
    const updateData: any = { status };
    if (trackingNumber) {
      updateData.trackingNumber = trackingNumber.trim();
    }

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: updateData,
    });

    await prisma.orderEvent.create({
      data: {
        orderId: req.params.id,
        status,
        note: `Status updated to ${status} by seller: ${seller.storeName}`,
      },
    });

    // Dispatch notifications via centralized dispatcher
    const eventMap: Record<string, string> = {
      PROCESSING: "ORDER_PROCESSING",
      SHIPPED: "ORDER_SHIPPED",
    };
    const notifEvent = eventMap[status];
    if (notifEvent) {
      enqueueNotification({
        event: notifEvent as any,
        recipientEmail: order.customerEmail || undefined,
        recipientPhone: order.customerPhone || undefined,
        recipientUserId: order.userId || undefined,
        orderId: order.id,
        data: {
          customerName: order.customerName,
          orderNumber: order.orderNumber,
          orderId: order.id,
          total: Number(order.totalAmount),
          currency: order.currency || "UGX",
          trackingNumber: order.trackingNumber || trackingNumber,
          estimatedDelivery: "2-3 business days",
        },
      }).catch((err) => logger.error("Notification dispatch failed", { error: err }));
    }

    // Auto-generate delivery OTP for COD (unpaid) orders when shipped
    if (status === "SHIPPED" && order.customerPhone && order.paymentStatus === "PENDING") {
      const otp = crypto.randomInt(100000, 999999).toString();
      const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      prisma.order.update({
        where: { id: order.id },
        data: { deliveryOtp: otp, deliveryOtpExpiry: expiry },
      }).then(() => {
        const msg = `Your delivery verification code for order ${order.orderNumber} is: ${otp}. Share this with the delivery agent upon receipt. Valid for 24 hours.`;
        sendWhatsApp({ to: order.customerPhone!, text: msg }).catch(() => {});
        sendSMS(order.customerPhone!, msg).catch(() => {});
      }).catch(err => logger.error("Auto OTP generation failed", { error: err }));
    }

    return res.json({ order });
  } catch (error) {
    logger.error("Update order status error", { error });
    return res.status(500).json({ error: "Failed to update order status" });
  }
}));

// GET /earnings — Earnings summary
router.get("/earnings", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const [totalWithdrawn, pendingPayouts, total] = await Promise.all([
      prisma.sellerPayout.aggregate({
        where: { sellerId: seller.id, status: "COMPLETED" },
        _sum: { amount: true },
      }),
      prisma.sellerPayout.aggregate({
        where: { sellerId: seller.id, status: { in: ["PENDING", "PROCESSING"] } },
        _sum: { amount: true },
      }),
      prisma.orderItem.count({ where: { sellerId: seller.id } }),
    ]);

    const recentItems = await prisma.orderItem.findMany({
      where: { sellerId: seller.id },
      orderBy: { order: { createdAt: "desc" } },
      skip,
      take: limit,
      include: {
        order: { select: { id: true, orderNumber: true, createdAt: true, status: true } },
        product: { select: { id: true, name: true, categoryId: true } },
      },
    });

    // Batch-load commission rates (2-3 queries total instead of per-item)
    const rateMap = await getCommissionRates(
      recentItems.map((i) => ({ sellerId: seller.id, categoryId: i.product?.categoryId || null }))
    );

    const recentTransactions = recentItems.map((item) => {
      const amount = Number(item.price) * item.quantity;
      const rateKey = `${seller.id}:${item.product?.categoryId || ""}`;
      const rate = rateMap.get(rateKey) ?? 15;
      const commission = Math.round((amount * rate) / 100);
      return {
        id: item.id,
        orderId: item.order.id,
        orderNumber: item.order.orderNumber,
        productName: item.product?.name || "Unknown Product",
        amount,
        commissionRate: rate,
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
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error("Earnings error", { error });
    return res.status(500).json({ error: "Failed to load earnings" });
  }
}));

// GET /earnings/invoice/:orderId — Structured invoice data
router.get("/earnings/invoice/:orderId", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;
    const order = await prisma.order.findUnique({
      where: { id: req.params.orderId },
      include: {
        items: {
          where: { sellerId: seller.id },
          include: { product: { select: { name: true, sku: true, categoryId: true } } },
        },
      },
    });

    if (!order || order.items.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const orderRateMap = await getCommissionRates(
      order.items.map((i) => ({ sellerId: seller.id, categoryId: i.product?.categoryId || null }))
    );

    const items = order.items.map((item) => {
      const amount = Number(item.price) * item.quantity;
      const rateKey = `${seller.id}:${item.product?.categoryId || ""}`;
      const rate = orderRateMap.get(rateKey) ?? 15;
      const commission = Math.round((amount * rate) / 100);
      return {
        productName: item.product?.name || "Unknown",
        sku: item.product?.sku || "",
        quantity: item.quantity,
        unitPrice: Number(item.price),
        amount,
        commissionRate: rate,
        commission,
        net: amount - commission,
      };
    });

    const totals = items.reduce(
      (acc, i) => ({ gross: acc.gross + i.amount, commission: acc.commission + i.commission, net: acc.net + i.net }),
      { gross: 0, commission: 0, net: 0 }
    );

    return res.json({
      invoice: {
        orderNumber: order.orderNumber,
        orderDate: order.createdAt,
        seller: { storeName: seller.storeName, email: seller.email, phone: seller.phone },
        customer: { name: order.customerName, email: order.customerEmail },
        items,
        totals,
      },
    });
  } catch (error) {
    logger.error("Invoice error", { error });
    return res.status(500).json({ error: "Failed to generate invoice" });
  }
}));

// POST /payouts/request — Request a payout
router.post("/payouts/request", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;

    const { amount, method } = req.body;
    const payoutAmount = Number(amount);

    if (!amount || isNaN(payoutAmount) || payoutAmount <= 0) {
      return res.status(400).json({ error: "Valid payout amount is required" });
    }

    // Calculate escrow-held balance
    const heldEscrowItems = await prisma.orderItem.findMany({
      where: {
        sellerId: seller.id,
        order: {
          escrow: {
            status: "HELD",
          },
        },
      },
      select: {
        price: true,
        quantity: true,
        commission: true,
        shippingFeeCharged: true,
      },
    });

    const heldBalance = heldEscrowItems.reduce((sum, item) => {
      const itemTotal = Number(item.price) * item.quantity;
      const commission = Number(item.commission || 0);
      const shippingFeeDeduction = Number(item.shippingFeeCharged || 0);
      return sum + (itemTotal - commission - shippingFeeDeduction);
    }, 0);

    const withdrawableBalance = Number(seller.balance) - heldBalance;

    if (payoutAmount > withdrawableBalance) {
      return res.status(400).json({
        error: `Insufficient withdrawable balance. Your total balance is UGX ${Number(seller.balance).toLocaleString()}, but UGX ${heldBalance.toLocaleString()} is currently held in escrow (buyer protection holding period). Withdrawable balance: UGX ${withdrawableBalance.toLocaleString()}.`,
      });
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

    // Auto-disburse for GOLD/SILVER sellers under UGX 500,000
    const autoDisburseEligible =
      ["GOLD", "SILVER"].includes(seller.tier) &&
      payoutAmount <= 500000 &&
      seller.payoutPhone;

    if (autoDisburseEligible) {
      try {
        const cleanPhone = (seller.payoutPhone || "").replace(/\D/g, "");
        let localPhone = cleanPhone;
        if (cleanPhone.startsWith("256") && cleanPhone.length === 12) {
          localPhone = cleanPhone.slice(3);
        } else if (cleanPhone.startsWith("0") && cleanPhone.length === 10) {
          localPhone = cleanPhone.slice(1);
        }
        const prefix2 = localPhone.slice(0, 2);
        const accountBank = ["70", "75", "74", "20"].includes(prefix2) ? "AIR" : "MPS";

        const transferResult = await createFlutterwaveTransfer({
          reference: `payout-${payout.id}`,
          amount: payoutAmount,
          currency: "UGX",
          narration: `PleasureZone payout for ${seller.storeName}`,
          beneficiary: {
            account_bank: accountBank,
            account_number: seller.payoutPhone,
            beneficiary_name: seller.storeName,
          },
        });

        if (transferResult.status === "success") {
          await prisma.sellerPayout.update({
            where: { id: payout.id },
            data: { status: "PROCESSING", reference: transferResult.data?.reference || `payout-${payout.id}` },
          });
          payout.status = "PROCESSING";
        }
      } catch (err) {
        logger.error("Auto-disburse failed", { payoutId: payout.id, error: err });
        // Payout stays PENDING for manual processing
      }
    }

    return res.status(201).json({ payout });
  } catch (error) {
    logger.error("Payout request error", { error });
    return res.status(500).json({ error: "Failed to request payout" });
  }
}));

// GET /payouts — List payout history
router.get("/payouts", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
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
    logger.error("List payouts error", { error });
    return res.status(500).json({ error: "Failed to load payouts" });
  }
}));

// PUT /payouts/schedule — Update payout schedule
router.put("/payouts/schedule", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;
    const { schedule, minAmount } = req.body;

    const validSchedules = ["MANUAL", "DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"];
    if (!schedule || !validSchedules.includes(schedule)) {
      return res.status(400).json({ error: "Invalid schedule. Must be MANUAL, DAILY, WEEKLY, BIWEEKLY, or MONTHLY" });
    }

    const minPayout = minAmount !== undefined ? Number(minAmount) : undefined;
    if (minPayout !== undefined && (isNaN(minPayout) || minPayout < 5000)) {
      return res.status(400).json({ error: "Minimum payout amount must be at least UGX 5,000" });
    }

    // Calculate next payout date based on schedule
    let nextPayoutDate: Date | null = null;
    if (schedule !== "MANUAL") {
      nextPayoutDate = new Date();
      switch (schedule) {
        case "DAILY": nextPayoutDate.setDate(nextPayoutDate.getDate() + 1); break;
        case "WEEKLY": nextPayoutDate.setDate(nextPayoutDate.getDate() + 7); break;
        case "BIWEEKLY": nextPayoutDate.setDate(nextPayoutDate.getDate() + 14); break;
        case "MONTHLY": nextPayoutDate.setMonth(nextPayoutDate.getMonth() + 1); break;
      }
      nextPayoutDate.setHours(9, 0, 0, 0); // Process at 9 AM
    }

    await prisma.seller.update({
      where: { id: seller.id },
      data: {
        payoutSchedule: schedule,
        nextPayoutDate,
        ...(minPayout !== undefined ? { minPayoutAmount: minPayout } : {}),
      },
    });

    return res.json({
      message: "Payout schedule updated",
      schedule,
      nextPayoutDate,
      minPayoutAmount: minPayout ?? Number(seller.minPayoutAmount),
    });
  } catch (error) {
    logger.error("Update payout schedule error", { error });
    return res.status(500).json({ error: "Failed to update payout schedule" });
  }
}));

// GET /profit-calculator — Per-product profit breakdown
router.get("/profit-calculator", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;

    // Get commission rate: seller override → category rules → default 10%
    const sellerCommission = seller.commissionRate ? Number(seller.commissionRate) : null;
    const categoryRules = await prisma.commissionRule.findMany({
      where: { isActive: true },
    });
    const defaultRule = categoryRules.find(r => r.categoryName === "Default" || !r.categoryId);
    const defaultRate = defaultRule ? Number(defaultRule.rate) : 10;

    // Get processing fee from settings
    const feeSetting = await prisma.setting.findUnique({ where: { key: "payment_processing_fee" } });
    const processingFee = feeSetting ? parseFloat(feeSetting.value) : 3.8;

    // Get seller's products with sales data
    const products = await prisma.product.findMany({
      where: { sellerId: seller.id, status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        price: true,
        sku: true,
        stock: true,
        categoryId: true,
        category: { select: { name: true } },
        _count: { select: { orderItems: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const breakdown = products.map(p => {
      const price = Number(p.price);
      // Commission: seller-specific > category rule > default
      let commissionRate = sellerCommission ?? defaultRate;
      if (!sellerCommission && p.categoryId) {
        const catRule = categoryRules.find(r => r.categoryId === p.categoryId);
        if (catRule) commissionRate = Number(catRule.rate);
      }
      const commission = price * (commissionRate / 100);
      const paymentFee = price * (processingFee / 100);
      const netEarnings = price - commission - paymentFee;

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        price,
        stock: p.stock,
        category: p.category?.name || "Uncategorized",
        unitsSold: p._count.orderItems,
        commissionRate,
        commissionAmount: Math.round(commission),
        processingFeeRate: processingFee,
        processingFeeAmount: Math.round(paymentFee),
        netEarnings: Math.round(netEarnings),
        margin: price > 0 ? Math.round((netEarnings / price) * 100) : 0,
        totalRevenue: Math.round(netEarnings * p._count.orderItems),
      };
    });

    return res.json({
      products: breakdown,
      summary: {
        defaultCommissionRate: sellerCommission ?? defaultRate,
        processingFeeRate: processingFee,
        totalProducts: breakdown.length,
        totalNetRevenue: breakdown.reduce((sum, p) => sum + p.totalRevenue, 0),
      },
    });
  } catch (error) {
    logger.error("Profit calculator error", { error });
    return res.status(500).json({ error: "Failed to calculate profits" });
  }
}));

// GET /conversion-funnel — Product conversion analytics
router.get("/conversion-funnel", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;
    const days = Math.min(parseInt(req.query.days as string) || 30, 90);
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Get product views from browse events
    const productViews = await prisma.browseEvent.count({
      where: {
        viewedAt: { gte: since },
        product: { sellerId: seller.id },
      },
    });

    // Get orders containing this seller's items
    const orders = await prisma.order.count({
      where: {
        createdAt: { gte: since },
        items: { some: { sellerId: seller.id } },
        status: { notIn: ["CANCELLED"] },
      },
    });

    // Get completed orders (delivered)
    const completedOrders = await prisma.order.count({
      where: {
        createdAt: { gte: since },
        items: { some: { sellerId: seller.id } },
        status: "DELIVERED",
      },
    });

    // Estimate add-to-cart as midpoint between views and orders (no direct cart tracking)
    const estimatedAddToCart = Math.round((productViews + orders) / 2);

    // Top products by views
    const topProducts = await prisma.browseEvent.groupBy({
      by: ["productId"],
      where: {
        viewedAt: { gte: since },
        product: { sellerId: seller.id },
      },
      _count: { productId: true },
      orderBy: { _count: { productId: "desc" } },
      take: 10,
    });

    const topProductIds = topProducts.map(t => t.productId);
    const topProductDetails = topProductIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: topProductIds } },
          select: { id: true, name: true, price: true, _count: { select: { orderItems: true } } },
        })
      : [];

    const topProductsWithConversion = topProducts.map(t => {
      const product = topProductDetails.find(p => p.id === t.productId);
      const viewCount = t._count.productId;
      return {
        productId: t.productId,
        name: product?.name || "Unknown",
        price: product ? Number(product.price) : 0,
        views: viewCount,
        orders: product?._count.orderItems || 0,
        conversionRate: viewCount > 0 && product
          ? Math.round((product._count.orderItems / viewCount) * 10000) / 100
          : 0,
      };
    });

    return res.json({
      period: `${days} days`,
      funnel: {
        views: productViews,
        addToCart: estimatedAddToCart,
        orders,
        completed: completedOrders,
      },
      conversionRates: {
        viewToCart: productViews > 0 ? Math.round((estimatedAddToCart / productViews) * 10000) / 100 : 0,
        cartToOrder: estimatedAddToCart > 0 ? Math.round((orders / estimatedAddToCart) * 10000) / 100 : 0,
        orderToComplete: orders > 0 ? Math.round((completedOrders / orders) * 10000) / 100 : 0,
        overall: productViews > 0 ? Math.round((orders / productViews) * 10000) / 100 : 0,
      },
      topProducts: topProductsWithConversion,
    });
  } catch (error) {
    logger.error("Conversion funnel error", { error });
    return res.status(500).json({ error: "Failed to load conversion data" });
  }
}));

// POST /products/ai-generate — AI-assisted product listing generation
router.post("/products/ai-generate", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
  try {
    const { name, category, keywords } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Product name is required" });
    }

    const categoryName = category || "General";
    const keywordList = keywords ? keywords.split(",").map((k: string) => k.trim()) : [];

    // Template-based AI generation (no external API required)
    const titleVariations = [
      `${name} - Premium Quality ${categoryName} Product`,
      `${name} | High-Quality ${categoryName} | Fast Delivery`,
      `Premium ${name} - Best ${categoryName} in Uganda`,
    ];

    const features = [
      "Premium quality materials",
      "Carefully selected and tested",
      "Discreet and secure packaging",
      "Fast delivery across Uganda",
      "100% satisfaction guaranteed",
    ];

    const description = `Discover the ${name}, a premium ${categoryName.toLowerCase()} product designed for quality and satisfaction.

Key Features:
${features.map(f => `• ${f}`).join("\n")}

${keywordList.length > 0 ? `\nPerfect for: ${keywordList.join(", ")}` : ""}

Why Choose Us?
We offer fast, discreet delivery across Uganda with secure packaging. Every product is carefully selected to ensure the highest quality standards.

Order today and experience the difference. Satisfaction guaranteed or your money back.`;

    const metaDescription = `Shop ${name} online. Premium ${categoryName.toLowerCase()} with fast discreet delivery in Uganda. ${keywordList.length > 0 ? keywordList.slice(0, 3).join(", ") + ". " : ""}Order now!`;

    const suggestedTags = [
      categoryName.toLowerCase(),
      ...name.toLowerCase().split(" ").filter((w: string) => w.length > 3),
      ...keywordList.map((k: string) => k.toLowerCase()),
      "uganda",
      "delivery",
      "premium",
    ].slice(0, 10);

    return res.json({
      suggestions: {
        titles: titleVariations,
        description,
        metaTitle: `${name} | ${categoryName} | Buy Online Uganda`,
        metaDescription: metaDescription.substring(0, 160),
        tags: [...new Set(suggestedTags)],
        seoKeywords: suggestedTags.join(", "),
      },
    });
  } catch (error) {
    logger.error("AI generate error", { error });
    return res.status(500).json({ error: "Failed to generate listing" });
  }
}));

// GET /profile — Get seller's own profile for settings
router.get("/profile", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;

    return res.json({ seller });
  } catch (error) {
    logger.error("Get seller profile error", { error });
    return res.status(500).json({ error: "Failed to load profile" });
  }
}));

// PUT /profile — Update seller profile
router.put("/profile", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
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
      idDocument,
      businessLicense,
      socialLinks,
      operatingHours,
      shippingPolicy,
      returnPolicy,
      notificationPrefs,
      allowsCustomerPickup,
      pickupAddress,
      pickupCity,
      pickupHours,
    } = req.body;

    const data: any = {};
    if (storeName !== undefined) data.storeName = sanitizeInput(storeName) || "Unnamed Store";
    if (description !== undefined) data.description = sanitizeInput(description);
    if (logo !== undefined) data.logo = logo || null;
    if (banner !== undefined) data.banner = banner || null;
    if (phone !== undefined) data.phone = sanitizeInput(phone);
    if (email !== undefined) data.email = sanitizeInput(email);
    if (website !== undefined) data.website = sanitizeInput(website);
    if (address !== undefined) data.address = sanitizeInput(address);
    if (city !== undefined) data.city = sanitizeInput(city);
    if (country !== undefined) data.country = sanitizeInput(country);
    if (payoutMethod !== undefined && ["MOBILE_MONEY", "BANK_TRANSFER", "FLUTTERWAVE"].includes(payoutMethod)) {
      data.payoutMethod = payoutMethod;
    }
    if (payoutPhone !== undefined) data.payoutPhone = sanitizeInput(payoutPhone);
    if (bankName !== undefined) data.bankName = sanitizeInput(bankName);
    if (bankAccount !== undefined) data.bankAccount = sanitizeInput(bankAccount);
    if (bankBranch !== undefined) data.bankBranch = sanitizeInput(bankBranch);
    if (idDocument !== undefined) data.idDocument = sanitizeInput(idDocument);
    if (businessLicense !== undefined) data.businessLicense = sanitizeInput(businessLicense);
    if (socialLinks !== undefined) data.socialLinks = socialLinks || null;
    if (operatingHours !== undefined) data.operatingHours = operatingHours || null;
    if (shippingPolicy !== undefined) data.shippingPolicy = sanitizeInput(shippingPolicy);
    if (returnPolicy !== undefined) data.returnPolicy = sanitizeInput(returnPolicy);
    if (notificationPrefs !== undefined) data.notificationPrefs = notificationPrefs || null;
    if (allowsCustomerPickup !== undefined) data.allowsCustomerPickup = !!allowsCustomerPickup;
    if (pickupAddress !== undefined) data.pickupAddress = sanitizeInput(pickupAddress);
    if (pickupCity !== undefined) data.pickupCity = sanitizeInput(pickupCity);
    if (pickupHours !== undefined) data.pickupHours = sanitizeInput(pickupHours);

    const updated = await prisma.seller.update({
      where: { id: seller.id },
      data,
    });

    return res.json({ seller: updated });
  } catch (error) {
    logger.error("Update profile error", { error });
    return res.status(500).json({ error: "Failed to update profile" });
  }
}));

// GET /reviews — List reviews of this seller
router.get("/reviews", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
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
    logger.error("List reviews error", { error });
    return res.status(500).json({ error: "Failed to load reviews" });
  }
}));

// POST /upload-images — Upload product images (max 10 files)
router.post("/upload-images", authenticate, requireSeller, uploadMultiple, validateUploadedFiles, asyncHandler(async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const urls = files.map((f) => `/uploads/${f.filename}`);
    return res.json({ urls });
  } catch (error) {
    logger.error("Upload images error", { error });
    return res.status(500).json({ error: "Failed to upload images" });
  }
}));

// POST /upload-documents — Upload KYC documents (max 5 files, images + PDF)
router.post("/upload-documents", authenticate, requireSeller, uploadDocuments, validateUploadedDocuments, asyncHandler(async (req: SellerRequest, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const urls = files.map((f) => `/uploads/${f.filename}`);
    return res.json({ urls });
  } catch (error) {
    logger.error("Upload documents error", { error });
    return res.status(500).json({ error: "Failed to upload documents" });
  }
}));

// ============ SELLER RETURNS ============

// GET /returns — List return requests for orders containing this seller's items
router.get("/returns", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
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
    logger.error("List seller returns error", { error });
    return res.status(500).json({ error: "Failed to load returns" });
  }
}));

// PUT /returns/:id — Seller adds notes to a return request
router.put("/returns/:id", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
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
    logger.error("Update seller return error", { error });
    return res.status(500).json({ error: "Failed to update return request" });
  }
}));

// ============ SELLER ANALYTICS ============

// GET /analytics — Seller analytics dashboard data
router.get("/analytics", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;

    // Support custom date range via from/to params, or period
    const fromParam = req.query.from as string;
    const toParam = req.query.to as string;
    const compareWith = req.query.compareWith as string;
    let startDate: Date;
    let endDate = new Date();
    let period: number;

    if (fromParam && toParam) {
      startDate = new Date(fromParam);
      endDate = new Date(toParam);
      endDate.setHours(23, 59, 59, 999);
      period = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    } else {
      period = Math.min(parseInt(req.query.period as string) || 30, 365);
      startDate = new Date();
      startDate.setDate(startDate.getDate() - period);
    }

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
      const addr = parseShippingAddress(item.order.shippingAddress);
      const city = addr?.city || "Unknown";
      cityMap[city] = (cityMap[city] || 0) + 1;
    }
    const customerGeography = Object.entries(cityMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Period comparison
    let comparison: any = null;
    if (compareWith === "previous") {
      const prevStart = new Date(startDate);
      prevStart.setDate(prevStart.getDate() - period);
      const prevEnd = new Date(startDate);
      prevEnd.setMilliseconds(prevEnd.getMilliseconds() - 1);

      const prevItems = await prisma.orderItem.findMany({
        where: {
          sellerId: seller.id,
          order: {
            createdAt: { gte: prevStart, lte: prevEnd },
            status: { in: ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] },
          },
        },
        include: { order: { select: { createdAt: true } } },
      });

      const prevRevenue = prevItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
      const prevUnitsSold = prevItems.reduce((sum, item) => sum + item.quantity, 0);
      const prevViews = productIds.length > 0
        ? await prisma.browseEvent.count({ where: { productId: { in: productIds }, viewedAt: { gte: prevStart, lte: prevEnd } } })
        : 0;
      const prevOrderCount = new Set(prevItems.map((i) => i.orderId)).size;
      const prevConversion = prevViews > 0 ? Math.round((prevOrderCount / prevViews) * 10000) / 100 : 0;

      comparison = {
        totalRevenue: prevRevenue,
        totalUnitsSold: prevUnitsSold,
        totalViews: prevViews,
        conversionRate: prevConversion,
        revenueChange: prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 10000) / 100 : null,
        unitsSoldChange: prevUnitsSold > 0 ? Math.round(((totalUnitsSold - prevUnitsSold) / prevUnitsSold) * 10000) / 100 : null,
        viewsChange: prevViews > 0 ? Math.round(((totalViews - prevViews) / prevViews) * 10000) / 100 : null,
        conversionChange: prevConversion > 0 ? Math.round(((conversionRate - prevConversion) / prevConversion) * 10000) / 100 : null,
      };
    }

    return res.json({
      summary: { totalRevenue, totalUnitsSold, totalViews, conversionRate },
      salesTrend,
      topProducts,
      revenueByCategory,
      customerGeography,
      comparison,
    });
  } catch (error) {
    logger.error("Analytics error", { error });
    return res.status(500).json({ error: "Failed to load analytics" });
  }
}));

// ============ SELLER REVIEWS ============

// GET /product-reviews — List reviews for seller's products
router.get("/product-reviews", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
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
    logger.error("List seller reviews error", { error });
    return res.status(500).json({ error: "Failed to load reviews" });
  }
}));

// POST /product-reviews/:id/reply — Seller replies to a review
router.post("/product-reviews/:id/reply", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
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
    logger.error("Reply to review error", { error });
    return res.status(500).json({ error: "Failed to reply to review" });
  }
}));

// ============ SELLER NOTIFICATIONS ============

// GET /notifications — Virtual notifications from recent activity
router.get("/notifications", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
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
    logger.error("Seller notifications error", { error });
    return res.status(500).json({ error: "Failed to load notifications" });
  }
}));

// ============ WARNINGS ============

// GET /warnings — Seller's own warnings
router.get("/warnings", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;
    const warnings = await prisma.sellerWarning.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ warnings });
  } catch (error) {
    logger.error("List seller warnings error", { error });
    return res.status(500).json({ error: "Failed to load warnings" });
  }
}));

// PUT /warnings/:id/acknowledge — Acknowledge a warning
router.put("/warnings/:id/acknowledge", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
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
    logger.error("Acknowledge warning error", { error });
    return res.status(500).json({ error: "Failed to acknowledge warning" });
  }
}));

// ============ SCORECARD ============

// GET /scorecard — Seller's own performance scorecard
router.get("/scorecard", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
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
    const customerRating = seller.rating ? Number(seller.rating) : 0;

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
    logger.error("Seller scorecard error", { error });
    return res.status(500).json({ error: "Failed to load scorecard" });
  }
}));

// ============ SELLER CHAT ============

// GET /chat/conversations — List conversations for this seller
router.get("/chat/conversations", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
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
    logger.error("List seller conversations error", { error });
    return res.status(500).json({ error: "Failed to load conversations" });
  }
}));

// GET /chat/:id/messages — Get messages for a conversation (seller side)
router.get("/chat/:id/messages", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
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
    logger.error("Get seller messages error", { error });
    return res.status(500).json({ error: "Failed to load messages" });
  }
}));

// POST /chat/:id/messages — Send message as seller
router.post("/chat/:id/messages", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;

    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
    });
    if (!conversation || conversation.sellerId !== seller.id) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const { message, attachment } = req.body;
    if ((!message || typeof message !== "string" || message.trim().length === 0) && !attachment) {
      return res.status(400).json({ error: "Message or attachment is required" });
    }

    const [chatMessage] = await prisma.$transaction([
      prisma.chatMessage.create({
        data: {
          conversationId: req.params.id,
          senderId: seller.id,
          senderType: "SELLER",
          message: message?.trim() || "",
          attachment: attachment?.trim() || null,
        },
      }),
      prisma.conversation.update({
        where: { id: req.params.id },
        data: { lastMessageAt: new Date() },
      }),
    ]);

    return res.status(201).json({ message: chatMessage });
  } catch (error) {
    logger.error("Send seller message error", { error });
    return res.status(500).json({ error: "Failed to send message" });
  }
}));

// GET /api/seller/onboarding-status — accessible by PENDING and APPROVED sellers
router.get("/onboarding-status", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const seller = await prisma.seller.findUnique({ where: { userId: req.user!.id } });
    if (!seller) {
      return res.status(403).json({ error: "Seller account required" });
    }

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
        link: "/seller/products?action=new",
      },
      {
        key: "payout",
        label: "Set up your payout method",
        completed: !!seller.payoutMethod && (!!seller.payoutPhone || !!seller.bankAccount),
        link: "/seller/settings",
      },
      {
        key: "kyc",
        label: "Upload National ID for verification",
        completed: !!seller.idDocument,
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
    logger.error("Onboarding status error", { error });
    return res.status(500).json({ error: "Failed to fetch onboarding status" });
  }
}));

// ============ SELLER COUPONS ============

// GET /coupons — List seller's coupons
router.get("/coupons", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;
    const coupons = await prisma.coupon.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ coupons });
  } catch (error) {
    logger.error("List seller coupons error", { error });
    return res.status(500).json({ error: "Failed to load coupons" });
  }
}));

// POST /coupons — Create a coupon
router.post("/coupons", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;
    const { code, description, type, value, minOrderAmount, maxDiscount, usageLimit, validFrom, validUntil } = req.body;

    if (!code || typeof code !== "string" || code.trim().length < 2) {
      return res.status(400).json({ error: "Coupon code is required (min 2 characters)" });
    }
    if (!type || !["PERCENTAGE", "FIXED"].includes(type)) {
      return res.status(400).json({ error: "Type must be PERCENTAGE or FIXED" });
    }
    if (value === undefined || isNaN(Number(value)) || Number(value) <= 0) {
      return res.status(400).json({ error: "Value must be a positive number" });
    }

    // Check for duplicate code
    const existing = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
    if (existing) {
      return res.status(400).json({ error: "A coupon with this code already exists" });
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: code.trim().toUpperCase(),
        description: description?.trim() || null,
        type,
        value: Number(value),
        minOrderAmount: minOrderAmount ? Number(minOrderAmount) : null,
        maxDiscount: maxDiscount ? Number(maxDiscount) : null,
        usageLimit: usageLimit ? parseInt(usageLimit) : null,
        validFrom: validFrom ? new Date(validFrom) : new Date(),
        validUntil: validUntil ? new Date(validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sellerId: seller.id,
      },
    });

    return res.status(201).json({ coupon });
  } catch (error) {
    logger.error("Create coupon error", { error });
    return res.status(500).json({ error: "Failed to create coupon" });
  }
}));

// PUT /coupons/:id — Update a coupon (verify ownership)
router.put("/coupons/:id", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;
    const coupon = await prisma.coupon.findUnique({ where: { id: req.params.id } });
    if (!coupon || coupon.sellerId !== seller.id) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    const { description, type, value, minOrderAmount, maxDiscount, usageLimit, validFrom, validUntil, active } = req.body;
    const data: any = {};
    if (description !== undefined) data.description = description?.trim() || null;
    if (type !== undefined && ["PERCENTAGE", "FIXED"].includes(type)) data.type = type;
    if (value !== undefined) data.value = Number(value);
    if (minOrderAmount !== undefined) data.minOrderAmount = minOrderAmount ? Number(minOrderAmount) : null;
    if (maxDiscount !== undefined) data.maxDiscount = maxDiscount ? Number(maxDiscount) : null;
    if (usageLimit !== undefined) data.usageLimit = usageLimit ? parseInt(usageLimit) : null;
    if (validFrom !== undefined) data.validFrom = new Date(validFrom);
    if (validUntil !== undefined) data.validUntil = new Date(validUntil);
    if (active !== undefined) data.active = !!active;

    const updated = await prisma.coupon.update({ where: { id: req.params.id }, data });
    return res.json({ coupon: updated });
  } catch (error) {
    logger.error("Update coupon error", { error });
    return res.status(500).json({ error: "Failed to update coupon" });
  }
}));

// DELETE /coupons/:id — Soft delete (set active: false)
router.delete("/coupons/:id", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;
    const coupon = await prisma.coupon.findUnique({ where: { id: req.params.id } });
    if (!coupon || coupon.sellerId !== seller.id) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    await prisma.coupon.update({ where: { id: req.params.id }, data: { active: false } });
    return res.json({ success: true });
  } catch (error) {
    logger.error("Delete coupon error", { error });
    return res.status(500).json({ error: "Failed to delete coupon" });
  }
}));

// GET /disputes — List disputes against this seller
router.get("/disputes", authenticate, requireSeller, asyncHandler(async (req: SellerRequest, res: Response) => {
  try {
    const seller = req.seller!;
    const disputes = await prisma.dispute.findMany({
      where: { sellerId: seller.id },
      include: {
        order: { select: { orderNumber: true, totalAmount: true, currency: true, status: true } },
        buyer: { select: { name: true, email: true } },
        _count: { select: { evidence: true, messages: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return res.json(disputes);
  } catch (error) {
    logger.error("List seller disputes error", { error });
    return res.status(500).json({ error: "Failed to fetch disputes" });
  }
}));

export default router;
