import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { sendWhatsApp } from "../services/whatsapp";

const router = Router();

// Session state stored in memory (use Redis for production scale)
const sessions: Map<string, { step: string; data: any }> = new Map();

function getSession(phone: string) {
  return sessions.get(phone) || { step: "start", data: {} };
}

function setSession(phone: string, step: string, data: any = {}) {
  sessions.set(phone, { step, data: { ...getSession(phone).data, ...data } });
  // Auto-expire sessions after 30 minutes
  setTimeout(() => sessions.delete(phone), 30 * 60 * 1000);
}

// ─── WhatsApp Webhook Verification ───────────────────────────────────────────
router.get("/webhook", (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ─── WhatsApp Webhook — Incoming Messages ────────────────────────────────────
router.post("/webhook", async (req: Request, res: Response) => {
  try {
    res.sendStatus(200); // Acknowledge immediately

    const body = req.body;
    if (!body?.entry?.[0]?.changes?.[0]?.value?.messages) return;

    const msg = body.entry[0].changes[0].value.messages[0];
    if (!msg || msg.type !== "text") return;

    const from = msg.from; // e.g. "256700000000"
    const text = (msg.text?.body || "").trim().toLowerCase();

    await handleMessage(from, text);
  } catch (error) {
    console.error("WhatsApp bot error:", error);
  }
});

async function handleMessage(phone: string, text: string): Promise<void> {
  const session = getSession(phone);

  // ── Global commands (work at any step) ──
  if (text === "menu" || text === "hi" || text === "hello" || text === "start") {
    setSession(phone, "menu");
    await sendWhatsApp({
      to: phone,
      text: `🛍️ *PleasureZone Uganda*\n\nHello! How can I help you?\n\n1️⃣ Browse products\n2️⃣ Track my order\n3️⃣ Talk to support\n\nReply with a number or keyword. Plain packaging. Discreet delivery. 🔒`,
    });
    return;
  }

  if (text === "0" || text === "back") {
    setSession(phone, "menu");
    await sendWhatsApp({
      to: phone,
      text: `Back to main menu:\n\n1️⃣ Browse products\n2️⃣ Track my order\n3️⃣ Talk to support`,
    });
    return;
  }

  // ── Menu selection ──
  if (session.step === "menu" || session.step === "start") {
    if (text === "1" || text === "browse" || text.includes("product")) {
      await showCategories(phone);
      return;
    }
    if (text === "2" || text === "track") {
      setSession(phone, "track");
      await sendWhatsApp({ to: phone, text: "Please enter your order number (e.g. PZ-ABC123):" });
      return;
    }
    if (text === "3" || text === "support") {
      await sendWhatsApp({
        to: phone,
        text: `💬 Support\n\nFor help with your order, WhatsApp us directly:\n📱 ${process.env.SUPPORT_PHONE || "+256700000000"}\n\nOr email: support@ugsex.com\n\nReply *menu* to go back.`,
      });
      return;
    }
  }

  // ── Category browsing ──
  if (session.step === "categories") {
    const categories = await prisma.category.findMany({ take: 8, orderBy: { name: "asc" } });
    const idx = parseInt(text) - 1;
    if (idx >= 0 && idx < categories.length) {
      const category = categories[idx];
      await showProducts(phone, category.id, category.name);
      return;
    }
  }

  // ── Product listing ──
  if (session.step === "products" && session.data.categoryId) {
    const products = await prisma.product.findMany({
      where: { categoryId: session.data.categoryId, status: "ACTIVE" },
      include: { images: { take: 1 } },
      take: 8,
    });
    const idx = parseInt(text) - 1;
    if (idx >= 0 && idx < products.length) {
      const product = products[idx];
      await showProduct(phone, product);
      return;
    }
  }

  // ── Order tracking ──
  if (session.step === "track") {
    const orderNumber = text.toUpperCase().replace(/^#/, "");
    const order = await prisma.order.findFirst({
      where: { orderNumber: { contains: orderNumber, mode: "insensitive" } },
      include: { timeline: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    if (!order) {
      await sendWhatsApp({ to: phone, text: `Order "${orderNumber}" not found. Please check the number and try again.\n\nReply *menu* to go back.` });
    } else {
      const status = order.status.replace(/_/g, " ");
      await sendWhatsApp({
        to: phone,
        text: `📦 Order *${order.orderNumber}*\n\nStatus: *${status}*\nTotal: UGX ${Number(order.totalAmount).toLocaleString()}\n${order.trackingNumber ? `Tracking: ${order.trackingNumber}` : ""}\n\nReply *menu* to go back.`,
      });
    }
    setSession(phone, "menu");
    return;
  }

  // ── Default ──
  await sendWhatsApp({
    to: phone,
    text: `Sorry, I didn't understand that. Reply *menu* to see options, or *browse* to shop. 🛍️`,
  });
}

async function showCategories(phone: string): Promise<void> {
  const categories = await prisma.category.findMany({ take: 8, orderBy: { name: "asc" } });
  setSession(phone, "categories", { categories: categories.map((c) => c.id) });

  const list = categories.map((c, i) => `${i + 1}️⃣ ${c.name}`).join("\n");
  await sendWhatsApp({
    to: phone,
    text: `🛍️ *Browse by Category*\n\n${list}\n\nReply with a number to browse, or *menu* to go back.`,
  });
}

async function showProducts(phone: string, categoryId: string, categoryName: string): Promise<void> {
  const products = await prisma.product.findMany({
    where: { categoryId, status: "ACTIVE" },
    take: 8,
    orderBy: { featured: "desc" },
  });

  setSession(phone, "products", { categoryId });

  if (products.length === 0) {
    await sendWhatsApp({ to: phone, text: `No products in ${categoryName} right now.\n\nReply *browse* to pick another category.` });
    return;
  }

  const list = products.map((p, i) =>
    `${i + 1}️⃣ ${p.name} — UGX ${Number(p.price).toLocaleString()}`
  ).join("\n");

  await sendWhatsApp({
    to: phone,
    text: `*${categoryName}*\n\n${list}\n\nReply with a number for details, or *0* to go back.`,
  });
}

async function showProduct(phone: string, product: any): Promise<void> {
  const url = `${process.env.FRONTEND_URL}/product/${product.slug}`;
  await sendWhatsApp({
    to: phone,
    text: `*${product.name}*\n💰 UGX ${Number(product.price).toLocaleString()}\n\n${product.description ? product.description.slice(0, 150) + "..." : ""}\n\n🔒 Plain packaging, discreet delivery\n\n👉 Order here: ${url}\n\nReply *0* to go back or *menu* for main menu.`,
  });
  setSession(phone, "product_detail", { productId: product.id });
}

export default router;
