/**
 * Diaspora Gifting — Stripe checkout for overseas Ugandans ordering locally
 * POST /api/diaspora/checkout  — create Stripe Payment Intent
 * POST /api/diaspora/webhook   — Stripe webhook (payment confirmed → create order)
 * GET  /api/diaspora/currencies — supported currencies + exchange rates
 */
import { Router, Request, Response } from "express";
import Stripe from "stripe";
import prisma from "../lib/prisma";
import { sendOrderConfirmationWhatsApp } from "../services/whatsapp";
import { sendOrderConfirmationSMS } from "../services/sms";
import { sendOrderReceivedEmail } from "../lib/email";
import { z } from "zod";

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2026-04-22.dahlia",
});

// Supported diaspora currencies
const DIASPORA_CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar", flag: "🇺🇸" },
  { code: "GBP", symbol: "£", name: "British Pound", flag: "🇬🇧" },
  { code: "EUR", symbol: "€", name: "Euro", flag: "🇪🇺" },
  { code: "CAD", symbol: "CA$", name: "Canadian Dollar", flag: "🇨🇦" },
];

// Get UGX rate for a foreign currency (how many UGX per 1 foreign unit)
// DB stores rates as "1 UGX = X foreign" so we need the inverse
async function getUgxRate(currency: string): Promise<number> {
  try {
    const rate = await prisma.currency.findFirst({
      where: { code: currency.toUpperCase(), isActive: true },
    });
    if (rate) {
      const dbRate = Number(rate.exchangeRate);
      // DB stores "1 UGX = 0.000267 USD" → we need "1 USD = 3745 UGX"
      if (dbRate > 0 && dbRate < 1) return Math.round(1 / dbRate);
      // If already stored as UGX per foreign (e.g. 3700), use directly
      if (dbRate > 100) return dbRate;
    }
  } catch {}
  const fallback: Record<string, number> = {
    USD: 3700, GBP: 4700, EUR: 4100, CAD: 2700,
  };
  return fallback[currency.toUpperCase()] || 3700;
}

const CheckoutSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
  })),
  currency: z.enum(["USD", "GBP", "EUR", "CAD"]),
  recipient: z.object({
    name: z.string().min(2),
    phone: z.string(),
    street: z.string(),
    city: z.string(),
    county: z.string().optional(),
  }),
  sender: z.object({
    name: z.string().min(2),
    email: z.string().email(),
  }),
  message: z.string().max(500).optional(),
});

// GET /api/diaspora/currencies
router.get("/currencies", (_req: Request, res: Response) => {
  return res.json({ currencies: DIASPORA_CURRENCIES });
});

// GET /api/diaspora/rates
router.get("/rates", async (_req: Request, res: Response) => {
  const rates: Record<string, number> = {};
  for (const c of DIASPORA_CURRENCIES) {
    rates[c.code] = await getUgxRate(c.code);
  }
  return res.json({ rates, base: "UGX" });
});

// POST /api/diaspora/checkout — create Stripe Payment Intent + pending order
router.post("/checkout", async (req: Request, res: Response) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: "International payments not yet configured. Contact support." });
    }

    const body = CheckoutSchema.parse(req.body);

    // Fetch products
    const productIds = body.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, status: "ACTIVE" },
      select: { id: true, name: true, price: true, slug: true },
    });

    if (products.length !== productIds.length) {
      return res.status(400).json({ error: "One or more products are unavailable" });
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Calculate total in UGX
    let ugxSubtotal = 0;
    const lineItems = body.items.map((item) => {
      const p = productMap.get(item.productId)!;
      const lineUgx = Number(p.price) * item.quantity;
      ugxSubtotal += lineUgx;
      return { name: p.name, quantity: item.quantity, price: Number(p.price), productId: p.id };
    });

    const shippingUgx = 5000;
    const ugxTotal = ugxSubtotal + shippingUgx;

    // Convert to payment currency
    const rate = await getUgxRate(body.currency);
    const foreignTotal = ugxTotal / rate;
    const stripeAmount = Math.round(foreignTotal * 100);

    const orderNumber = `PZ-DG-${Date.now().toString(36).toUpperCase()}`;

    // Create Stripe Payment Intent
    const intent = await stripe.paymentIntents.create({
      amount: stripeAmount,
      currency: body.currency.toLowerCase(),
      metadata: {
        orderNumber,
        senderName: body.sender.name,
        senderEmail: body.sender.email,
        recipientPhone: body.recipient.phone,
        ugxTotal: ugxTotal.toString(),
        message: body.message || "",
      },
      receipt_email: body.sender.email,
      description: `PleasureZone gift to Uganda — ${orderNumber}`,
    });

    // Create pending order
    await prisma.order.create({
      data: {
        orderNumber,
        customerName: body.sender.name,
        customerEmail: body.sender.email,
        customerPhone: body.recipient.phone,
        shippingAddress: JSON.stringify({
          name: body.recipient.name,
          phone: body.recipient.phone,
          street: body.recipient.street,
          city: body.recipient.city,
          county: body.recipient.county || "",
          country: "Uganda",
        }),
        subtotal: ugxSubtotal,
        shippingCost: shippingUgx,
        totalAmount: ugxTotal,
        status: "PENDING",
        paymentStatus: "PENDING",
        discreet: true,
        isGift: true,
        giftMessage: body.message || null,
        notes: `Diaspora order. Stripe PI: ${intent.id}. Paid ${body.currency} ${(stripeAmount / 100).toFixed(2)} @ rate ${rate}`,
        items: {
          create: lineItems.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            productId: item.productId,
          })),
        },
      },
    });

    return res.json({
      clientSecret: intent.client_secret,
      orderNumber,
      ugxTotal,
      foreignAmount: stripeAmount / 100,
      currency: body.currency,
    });
  } catch (err: any) {
    console.error("Diaspora checkout error:", err.message);
    if (err.name === "ZodError") {
      return res.status(400).json({ error: err.errors[0]?.message || "Invalid request" });
    }
    return res.status(500).json({ error: "Checkout failed. Please try again." });
  }
});

// POST /api/diaspora/webhook — Stripe webhook (raw body required)
router.post("/webhook", async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: any;
  try {
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      // Dev mode: parse raw body manually
      event = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    }
  } catch (err: any) {
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object;
    const { orderNumber, recipientPhone, senderEmail, senderName, message } = intent.metadata || {};

    if (orderNumber) {
      try {
        await prisma.order.update({
          where: { orderNumber },
          data: { paymentStatus: "SUCCESSFUL", status: "CONFIRMED" },
        });

        const order = await prisma.order.findUnique({
          where: { orderNumber },
          include: { items: true },
        });

        if (order) {
          // Notify recipient
          if (recipientPhone) {
            const itemNames = order.items.map((i: any) => i.name).join(", ");
            const preview = message ? ` Message: "${message}"` : "";
            await sendOrderConfirmationWhatsApp(
              recipientPhone,
              orderNumber,
              `UGX ${Number(order.totalAmount).toLocaleString()} — ${itemNames}.${preview} Plain packaging 🔒`
            ).catch(() => {});
            if (!recipientPhone.startsWith("+") && !recipientPhone.startsWith("0")) return;
            await sendOrderConfirmationSMS(recipientPhone, orderNumber, `UGX ${Number(order.totalAmount).toLocaleString()}`).catch(() => {});
          }

          // Email sender
          if (senderEmail) {
            await sendOrderReceivedEmail({
              to: senderEmail,
              name: senderName || "Sender",
              orderNumber,
              items: order.items.map((i: any) => ({ name: i.name, quantity: i.quantity, price: Number(i.price) })),
              total: Number(order.totalAmount),
              currency: "UGX",
            }).catch(() => {});
          }
        }
      } catch (err: any) {
        console.error("Diaspora webhook processing error:", err.message);
      }
    }
  }

  return res.json({ received: true });
});

export default router;
