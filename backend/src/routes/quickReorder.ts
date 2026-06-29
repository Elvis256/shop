import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import redis from "../lib/redis";
import { authenticate, AuthRequest } from "../middleware/auth";
import { createFlutterwavePayment } from "../services/flutterwave";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";
import { reserveStock } from "../utils/stockReservation";
import crypto from "crypto";

const router = Router();
const TOKEN_TTL = 72 * 60 * 60; // 72 hours

class StockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockError";
  }
}

interface ReorderData {
  userId: string;
  productId: string;
  productName: string;
  productSlug: string;
  productPrice: number;
  currency: string;
  quantity: number;
  address: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

// POST /api/quick-reorder/create — Generate a reorder token
router.post("/create", authenticate, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  // Find last delivered order for this user
  const lastOrder = await prisma.order.findFirst({
    where: { userId, status: "DELIVERED" },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        include: { product: { select: { id: true, name: true, slug: true, price: true, stock: true } } },
        take: 1,
      },
    },
  });

  if (!lastOrder || lastOrder.items.length === 0) {
    return res.status(404).json({ error: "No previous orders found" });
  }

  const item = lastOrder.items[0];
  const token = crypto.randomBytes(16).toString("hex");

  const reorderData: ReorderData = {
    userId,
    productId: item.product.id,
    productName: item.product.name,
    productSlug: item.product.slug,
    productPrice: Number(item.product.price),
    currency: lastOrder.currency,
    quantity: 1,
    address: lastOrder.shippingAddress,
    customerName: lastOrder.customerName,
    customerEmail: lastOrder.customerEmail,
    customerPhone: lastOrder.customerPhone || "",
  };

  try {
    await redis.set(`reorder:${token}`, JSON.stringify(reorderData), "EX", TOKEN_TTL);
  } catch {
    // Redis unavailable — store in-memory fallback not ideal but works
    return res.status(500).json({ error: "Reorder service temporarily unavailable" });
  }

  const BASE_URL = process.env.FRONTEND_URL || "https://ugsex.com";
  return res.json({ token, url: `${BASE_URL}/reorder/${token}` });
}));

// GET /api/quick-reorder/:token — Fetch reorder details
router.get("/:token", asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;

  let raw: string | null;
  try {
    raw = await redis.get(`reorder:${token}`);
  } catch {
    return res.status(500).json({ error: "Reorder service temporarily unavailable" });
  }

  if (!raw) {
    return res.status(404).json({ error: "Reorder link expired or invalid" });
  }

  const data: ReorderData = JSON.parse(raw);

  // Check current stock and price
  const product = await prisma.product.findUnique({
    where: { id: data.productId },
    select: { id: true, name: true, slug: true, price: true, stock: true, images: { select: { url: true }, take: 1 } },
  });

  if (!product) {
    return res.status(404).json({ error: "Product no longer available" });
  }

  return res.json({
    product: {
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: Number(product.price),
      stock: product.stock,
      imageUrl: product.images[0]?.url,
    },
    address: data.address,
    customerName: data.customerName,
    currency: data.currency,
    quantity: data.quantity,
    inStock: product.stock > 0,
  });
}));

// POST /api/quick-reorder/:token/confirm — Confirm reorder and create order
router.post("/:token/confirm", asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;
  const { paymentMethod, mobileNetwork, mobilePhone } = req.body;

  let raw: string | null;
  try {
    raw = await redis.get(`reorder:${token}`);
  } catch {
    return res.status(500).json({ error: "Reorder service temporarily unavailable" });
  }

  if (!raw) {
    return res.status(404).json({ error: "Reorder link expired or invalid" });
  }

  const data: ReorderData = JSON.parse(raw);

  // Verify product still exists
  const product = await prisma.product.findUnique({
    where: { id: data.productId },
    select: { id: true, name: true, price: true, sellerId: true },
  });

  if (!product) {
    return res.status(404).json({ error: "Product no longer available" });
  }

  const totalAmount = Number(product.price) * data.quantity;
  const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

  // Create order and reserve stock atomically to prevent overselling
  let order: { id: string };
  try {
    order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber,
          userId: data.userId,
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          customerPhone: data.customerPhone,
          shippingAddress: data.address,
          subtotal: totalAmount,
          totalAmount,
          currency: data.currency,
          status: "PENDING",
          paymentStatus: "PENDING",
          items: {
            create: {
              productId: product.id,
              name: product.name,
              price: Number(product.price),
              quantity: data.quantity,
              sellerId: product.sellerId,
            },
          },
        },
      });

      const reserveResult = await reserveStock(
        tx,
        [{ productId: product.id, quantity: data.quantity, product: { name: product.name } }],
        created.id,
        30 * 60 * 1000 // 30 min reservation for quick reorders
      );

      if (!reserveResult.success) {
        throw new StockError(reserveResult.error || "Stock reservation failed");
      }

      return created;
    });
  } catch (error) {
    if (error instanceof StockError) {
      return res.status(400).json({ error: error.message });
    }
    throw error;
  }

  // Delete the reorder token
  try { await redis.del(`reorder:${token}`); } catch {}

  // If mobile money, initiate Flutterwave payment
  if (paymentMethod === "mobile_money" && mobileNetwork && mobilePhone) {
    const BASE_URL = process.env.FRONTEND_URL || "https://ugsex.com";
    const result = await createFlutterwavePayment({
      tx_ref: order.id,
      amount: totalAmount,
      currency: data.currency,
      customer: { name: data.customerName, email: data.customerEmail },
      paymentMethod: "mobile_money",
      mobileMoney: { network: mobileNetwork, phone: mobilePhone },
      redirect_url: `${BASE_URL}/account/orders`,
    });

    await prisma.payment.create({
      data: {
        orderId: order.id,
        amount: totalAmount,
        currency: data.currency,
        method: "MOBILE_MONEY",
        status: "PENDING",
        flwRef: order.id,
      },
    });

    return res.json({ orderId: order.id, orderNumber, paymentLink: result.data?.link });
  }

  // COD
  return res.json({ orderId: order.id, orderNumber, message: "Order placed — pay on delivery" });
}));

// Utility: generate reorder token for a user's product
export async function generateReorderToken(userId: string, productId: string): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, phone: true },
    });

    const lastOrder = await prisma.order.findFirst({
      where: { userId, status: "DELIVERED" },
      orderBy: { createdAt: "desc" },
      select: { shippingAddress: true, currency: true },
    });

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, slug: true, price: true },
    });

    if (!user || !lastOrder || !product) return null;

    const token = crypto.randomBytes(16).toString("hex");
    const data: ReorderData = {
      userId,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      productPrice: Number(product.price),
      currency: lastOrder.currency,
      quantity: 1,
      address: lastOrder.shippingAddress,
      customerName: user.name || "",
      customerEmail: user.email,
      customerPhone: user.phone || "",
    };

    await redis.set(`reorder:${token}`, JSON.stringify(data), "EX", TOKEN_TTL);
    return token;
  } catch {
    return null;
  }
}

export default router;
