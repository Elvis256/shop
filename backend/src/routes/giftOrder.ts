import { Router, Request, Response } from "express";
import { z } from "zod";
import { nanoid } from "nanoid";
import prisma from "../lib/prisma";
import { optionalAuth, AuthRequest } from "../middleware/auth";
import { sendWhatsApp } from "../services/whatsapp";
import { sendSMS } from "../services/sms";

const router = Router();

// ─── Initiate a gift order ────────────────────────────────────────────────────
// Sender pays, recipient gets a WhatsApp/SMS link to choose delivery address.
router.post("/initiate", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const data = z.object({
      items: z.array(z.object({
        productId: z.string(),
        quantity: z.number().int().min(1),
      })).min(1),
      giftRecipientPhone: z.string().min(9),
      giftMessage: z.string().max(300).optional(),
      senderName: z.string().min(1).max(60).default("Someone special"),
    }).parse(req.body);

    // Normalize recipient phone
    let phone = data.giftRecipientPhone.replace(/\s+/g, "");
    if (phone.startsWith("0")) phone = "+256" + phone.slice(1);
    if (!phone.startsWith("+")) phone = "+256" + phone;

    // Build order items with current prices
    const products = await prisma.product.findMany({
      where: { id: { in: data.items.map((i) => i.productId) }, status: "ACTIVE" },
      include: { images: { take: 1, orderBy: { position: "asc" } } },
    });

    if (products.length !== data.items.length) {
      return res.status(400).json({ error: "One or more products not found or unavailable" });
    }

    const subtotal = data.items.reduce((sum, item) => {
      const product = products.find((p) => p.id === item.productId)!;
      return sum + Number(product.price) * item.quantity;
    }, 0);

    const giftToken = nanoid(32);
    const orderNumber = `PZ-GIFT-${Date.now().toString(36).toUpperCase()}`;

    // Create a pending gift order (no address yet — recipient will provide it)
    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId: req.user?.id || null,
        customerName: data.senderName,
        customerEmail: req.user?.email || "gift@ugsex.com",
        customerPhone: null,
        shippingAddress: JSON.stringify({ pending: true }),
        subtotal,
        totalAmount: subtotal,
        status: "PENDING",
        paymentStatus: "PENDING",
        discreet: true,
        isGift: true,
        giftRecipientPhone: phone,
        giftMessage: data.giftMessage,
        giftToken,
        giftAddressSet: false,
        items: {
          create: data.items.map((item) => {
            const product = products.find((p) => p.id === item.productId)!;
            return {
              productId: product.id,
              name: product.name,
              price: product.price,
              quantity: item.quantity,
            };
          }),
        },
      },
    });

    // Notify recipient via WhatsApp / SMS
    const addressUrl = `${process.env.FRONTEND_URL}/gift/${giftToken}`;
    const senderLabel = data.senderName === "Someone special" ? "Someone special" : data.senderName;
    const message = data.giftMessage
      ? `🎁 ${senderLabel} sent you a gift!\n\n"${data.giftMessage}"\n\nChoose where to deliver it (plain packaging, discreet):\n${addressUrl}`
      : `🎁 ${senderLabel} sent you a gift from PleasureZone!\n\nChoose your delivery address (plain packaging):\n${addressUrl}`;

    const waSent = await sendWhatsApp({ to: phone, text: message });
    if (!waSent) await sendSMS(phone, message);

    return res.status(201).json({
      orderId: order.id,
      orderNumber,
      message: "Gift initiated — recipient notified to choose delivery address",
      nextStep: "Complete payment to confirm gift",
      checkoutData: {
        orderId: order.id,
        amount: subtotal,
        currency: "UGX",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Gift initiate error:", error);
    return res.status(500).json({ error: "Failed to initiate gift" });
  }
});

// ─── Recipient sets their delivery address ────────────────────────────────────
router.post("/set-address/:token", async (req: Request, res: Response) => {
  try {
    const data = z.object({
      name: z.string().min(1),
      phone: z.string().min(9),
      street: z.string().min(1),
      city: z.string().min(1),
      county: z.string().optional(),
    }).parse(req.body);

    const order = await prisma.order.findUnique({ where: { giftToken: req.params.token } });
    if (!order) return res.status(404).json({ error: "Gift link not found or expired" });
    if (order.giftAddressSet) return res.status(409).json({ error: "Address already set" });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        shippingAddress: JSON.stringify({ ...data, country: "Uganda" }),
        customerName: data.name,
        customerPhone: data.phone,
        giftAddressSet: true,
      },
    });

    return res.json({
      message: "Delivery address saved. Your gift is on its way once payment is confirmed!",
      orderNumber: order.orderNumber,
    });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: error.errors });
    return res.status(500).json({ error: "Failed to set address" });
  }
});

// ─── Get gift order details by token (for recipient page) ────────────────────
router.get("/view/:token", async (req: Request, res: Response) => {
  try {
    const order = await prisma.order.findUnique({
      where: { giftToken: req.params.token },
      include: { items: { include: { product: { include: { images: { take: 1 } } } } } },
    });

    if (!order) return res.status(404).json({ error: "Gift link not found" });

    return res.json({
      orderNumber: order.orderNumber,
      message: order.giftMessage,
      addressSet: order.giftAddressSet,
      status: order.status,
      items: order.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        imageUrl: item.product.images[0]?.url || null,
      })),
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load gift" });
  }
});

export default router;
