import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateApiKey, requirePermission, ApiKeyRequest } from "../middleware/apiKeyAuth";

const router = Router();
const prisma = new PrismaClient();

const VALID_ORDER_STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];

// All routes require API key
router.use(authenticateApiKey);

// ── Products ──────────────────────────────────────────

// GET /api/v1/products
router.get("/products", requirePermission("products:read"), async (req: ApiKeyRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page as string) || 20));
    const category = req.query.category as string;
    const status = req.query.status as string;
    const search = req.query.search as string;

    const where: any = {};
    if (category) where.category = { slug: category };
    if (status) where.status = status;
    if (search) where.name = { contains: search, mode: "insensitive" };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true, name: true, slug: true, description: true,
          price: true, comparePrice: true, currency: true,
          stock: true, sku: true, status: true,
          rating: true, reviewCount: true,
          featured: true, isNew: true, isBestseller: true,
          weight: true, tags: true,
          category: { select: { id: true, name: true, slug: true } },
          images: { select: { url: true, position: true }, orderBy: { position: "asc" } },
          variants: { select: { id: true, name: true, size: true, color: true, price: true, stock: true, sku: true } },
          createdAt: true, updatedAt: true,
        },
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      data: products,
      pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL", message: "Failed to fetch products" } });
  }
});

// GET /api/v1/products/:idOrSlug
router.get("/products/:idOrSlug", requirePermission("products:read"), async (req: ApiKeyRequest, res: Response) => {
  try {
    const { idOrSlug } = req.params;
    const product = await prisma.product.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: { orderBy: { position: "asc" } },
        variants: true,
      },
    });
    if (!product) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Product not found" } });
    res.json({ data: product });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL", message: "Failed to fetch product" } });
  }
});

// ── Orders ──────────────────────────────────────────

// GET /api/v1/orders
router.get("/orders", requirePermission("orders:read"), async (req: ApiKeyRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page as string) || 20));
    const status = req.query.status as string;
    const since = req.query.since as string;

    const where: any = {};
    if (status) {
      if (!VALID_ORDER_STATUSES.includes(status)) {
        return res.status(400).json({ error: { code: "BAD_REQUEST", message: `Invalid status. Valid: ${VALID_ORDER_STATUSES.join(", ")}` } });
      }
      where.status = status;
    }
    if (since) {
      const sinceDate = new Date(since);
      if (isNaN(sinceDate.getTime())) {
        return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Invalid 'since' date. Use ISO 8601 format." } });
      }
      where.createdAt = { gte: sinceDate };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        select: {
          id: true, orderNumber: true,
          customerName: true, customerEmail: true, customerPhone: true,
          shippingAddress: true, shippingMethod: true, trackingNumber: true,
          subtotal: true, discount: true, tax: true, shippingCost: true, totalAmount: true, currency: true,
          status: true, paymentStatus: true,
          notes: true,
          items: { select: { id: true, quantity: true, price: true, product: { select: { id: true, name: true, slug: true, sku: true } } } },
          createdAt: true, updatedAt: true,
        },
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy: { createdAt: "desc" },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ data: orders, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL", message: "Failed to fetch orders" } });
  }
});

// GET /api/v1/orders/:id
router.get("/orders/:id", requirePermission("orders:read"), async (req: ApiKeyRequest, res: Response) => {
  try {
    const order = await prisma.order.findFirst({
      where: { OR: [{ id: req.params.id }, { orderNumber: req.params.id }] },
      include: {
        items: { include: { product: { select: { id: true, name: true, slug: true, sku: true, images: { take: 1 } } } } },
        payments: { select: { id: true, method: true, amount: true, status: true, createdAt: true } },
        timeline: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!order) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Order not found" } });
    res.json({ data: order });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL", message: "Failed to fetch order" } });
  }
});

// PUT /api/v1/orders/:id
router.put("/orders/:id", requirePermission("orders:write"), async (req: ApiKeyRequest, res: Response) => {
  try {
    const { status, trackingNumber, notes } = req.body;

    if (status && !VALID_ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ error: { code: "BAD_REQUEST", message: `Invalid status. Valid: ${VALID_ORDER_STATUSES.join(", ")}` } });
    }

    if (trackingNumber !== undefined && typeof trackingNumber !== "string") {
      return res.status(400).json({ error: { code: "BAD_REQUEST", message: "trackingNumber must be a string" } });
    }

    const order = await prisma.order.findFirst({
      where: { OR: [{ id: req.params.id }, { orderNumber: req.params.id }] },
    });
    if (!order) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Order not found" } });

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        ...(status && { status }),
        ...(trackingNumber !== undefined && { trackingNumber }),
        ...(notes !== undefined && { notes: String(notes) }),
      },
      select: { id: true, orderNumber: true, status: true, trackingNumber: true, updatedAt: true },
    });

    res.json({ data: updated });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL", message: "Failed to update order" } });
  }
});

// ── Customers ──────────────────────────────────────────

// GET /api/v1/customers
router.get("/customers", requirePermission("customers:read"), async (req: ApiKeyRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page as string) || 20));
    const search = req.query.search as string;

    const where: any = { role: "CUSTOMER" };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, email: true, name: true, phone: true,
          createdAt: true,
          _count: { select: { orders: true, reviews: true } },
        },
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ data: customers, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL", message: "Failed to fetch customers" } });
  }
});

// ── Categories ──────────────────────────────────────────

// GET /api/v1/categories
router.get("/categories", requirePermission("products:read"), async (_req: ApiKeyRequest, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      select: {
        id: true, name: true, slug: true, description: true, imageUrl: true,
        _count: { select: { products: true } },
      },
      orderBy: { name: "asc" },
    });
    res.json({ data: categories });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL", message: "Failed to fetch categories" } });
  }
});

// ── Inventory ──────────────────────────────────────────

// GET /api/v1/inventory
router.get("/inventory", requirePermission("inventory:read"), async (req: ApiKeyRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page as string) || 50));
    const lowStock = req.query.low_stock === "true";

    const where: any = { status: "ACTIVE" };
    if (lowStock) {
      where.stock = { lte: 10 };
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true, name: true, sku: true, slug: true,
          stock: true, reservedStock: true, lowStockAlert: true,
          trackInventory: true, allowBackorder: true,
          variants: { select: { id: true, name: true, size: true, color: true, stock: true, sku: true } },
        },
        skip: (page - 1) * perPage,
        take: perPage,
        orderBy: { stock: "asc" },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({ data: products, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL", message: "Failed to fetch inventory" } });
  }
});

// PUT /api/v1/inventory/:id
router.put("/inventory/:id", requirePermission("inventory:write"), async (req: ApiKeyRequest, res: Response) => {
  try {
    const { stock } = req.body;
    if (stock === undefined || stock === null) {
      return res.status(400).json({ error: { code: "BAD_REQUEST", message: "stock is required" } });
    }

    const parsed = parseInt(stock);
    if (isNaN(parsed) || parsed < 0) {
      return res.status(400).json({ error: { code: "BAD_REQUEST", message: "stock must be a non-negative integer" } });
    }

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { stock: parsed },
      select: { id: true, name: true, sku: true, stock: true },
    });
    res.json({ data: product });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL", message: "Failed to update inventory" } });
  }
});

// ── Webhooks info ──────────────────────────────────────────

// GET /api/v1/webhooks
router.get("/webhooks", requirePermission("webhooks:read"), async (_req: ApiKeyRequest, res: Response) => {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      select: { id: true, url: true, events: true, isActive: true, failCount: true, createdAt: true },
    });
    res.json({ data: endpoints });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL", message: "Failed to fetch webhooks" } });
  }
});

export default router;
