import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { sendWhatsApp } from "../services/whatsapp";
import { createFlutterwavePayment, chargeMobileMoneyUganda } from "../services/flutterwave";
import { generateAIResponse } from "../services/aiAssistant";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

// WhatsApp session with cart, language, and shipping
interface WhatsAppSession {
  step: string;
  data: any;
  cart: Array<{ productId: string; name: string; price: number; quantity: number }>;
  language: "en" | "lg" | "sw";
  shipping: { name?: string; phone?: string; street?: string; city?: string };
}

const sessions: Map<string, WhatsAppSession> = new Map();

function getSession(phone: string): WhatsAppSession {
  return sessions.get(phone) || { step: "start", data: {}, cart: [], language: "en", shipping: {} };
}

function setSession(phone: string, updates: Partial<WhatsAppSession>) {
  const current = getSession(phone);
  sessions.set(phone, { ...current, ...updates, data: { ...current.data, ...(updates.data || {}) } });
  // Auto-expire sessions after 30 minutes
  setTimeout(() => sessions.delete(phone), 30 * 60 * 1000);
}

// Simple translation strings for bot messages
const botStrings: Record<string, Record<string, string>> = {
  welcome: {
    en: `🛍️ *PleasureZone Uganda*\n\nHello! How can I help you?\n\n1️⃣ Browse products\n2️⃣ Track my order\n3️⃣ My Cart ({count} items)\n4️⃣ Checkout\n5️⃣ Talk to support\n6️⃣ Change language\n\nReply with a number. Discreet delivery. 🔒`,
    lg: `🛍️ *PleasureZone Uganda*\n\nOli otya! Nkuyambe ntya?\n\n1️⃣ Laba ebintu\n2️⃣ Londoola order yo\n3️⃣ Akakebe ko ({count} ebintu)\n4️⃣ Sasula\n5️⃣ Obuyambi\n6️⃣ Kyusa olulimi\n\nDdamu ne nnamba. 🔒`,
    sw: `🛍️ *PleasureZone Uganda*\n\nHabari! Nikusaidie nini?\n\n1️⃣ Angalia bidhaa\n2️⃣ Fuatilia agizo\n3️⃣ Kikapu ({count} vitu)\n4️⃣ Lipia\n5️⃣ Msaada\n6️⃣ Badilisha lugha\n\nJibu na nambari. 🔒`,
  },
  backToMenu: {
    en: "Reply *menu* to go back.",
    lg: "Ddamu *menu* okudda.",
    sw: "Jibu *menu* kurudi.",
  },
  emptyCart: {
    en: "Your cart is empty. Reply *browse* to shop.",
    lg: "Akakebe ko kali kakyama. Ddamu *browse* okugula.",
    sw: "Kikapu chako ni tupu. Jibu *browse* kununua.",
  },
  addedToCart: {
    en: "Added {qty}× {name} to cart. Cart total: UGX {total}. Type *cart* to view or *checkout* to buy.",
    lg: "Otaddeyo {qty}× {name}. Omuwendo: UGX {total}. Wandiika *cart* okulaba oba *checkout* okugula.",
    sw: "Imeongezwa {qty}× {name}. Jumla: UGX {total}. Andika *cart* kuona au *checkout* kununua.",
  },
  langSelect: {
    en: "Choose language:\n1. English\n2. Luganda\n3. Kiswahili",
    lg: "Londa olulimi:\n1. English\n2. Luganda\n3. Kiswahili",
    sw: "Chagua lugha:\n1. English\n2. Luganda\n3. Kiswahili",
  },
};

function t(key: string, lang: string, vars: Record<string, string | number> = {}): string {
  let str = botStrings[key]?.[lang] || botStrings[key]?.en || key;
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(`{${k}}`, String(v));
  }
  return str;
}

function cartTotal(cart: WhatsAppSession["cart"]): number {
  return cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
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
router.post("/webhook", asyncHandler(async (req: Request, res: Response) => {
  try {
    res.sendStatus(200); // Acknowledge immediately

    const body = req.body;
    if (!body?.entry?.[0]?.changes?.[0]?.value?.messages) return;

    const msg = body.entry[0].changes[0].value.messages[0];
    if (!msg || msg.type !== "text") return;

    const from = msg.from;
    const text = (msg.text?.body || "").trim().toLowerCase();

    await handleMessage(from, text);
  } catch (error) {
    logger.error("WhatsApp bot error", { error });
  }
}));

async function handleMessage(phone: string, text: string): Promise<void> {
  const session = getSession(phone);
  const lang = session.language;

  // ── Global commands ──
  if (text === "menu" || text === "hi" || text === "hello" || text === "start") {
    setSession(phone, { step: "menu" });
    await sendWhatsApp({
      to: phone,
      text: t("welcome", lang, { count: session.cart.length }),
    });
    return;
  }

  if (text === "0" || text === "back") {
    setSession(phone, { step: "menu" });
    await sendWhatsApp({
      to: phone,
      text: t("welcome", lang, { count: session.cart.length }),
    });
    return;
  }

  // ── Language selection flow ──
  if (session.step === "lang_select") {
    if (text === "1") setSession(phone, { language: "en", step: "menu" });
    else if (text === "2") setSession(phone, { language: "lg", step: "menu" });
    else if (text === "3") setSession(phone, { language: "sw", step: "menu" });
    else {
      await sendWhatsApp({ to: phone, text: t("langSelect", lang) });
      return;
    }
    const newLang = getSession(phone).language;
    await sendWhatsApp({ to: phone, text: t("welcome", newLang, { count: session.cart.length }) });
    return;
  }

  // ── Menu selection ──
  if (session.step === "menu" || session.step === "start") {
    if (text === "1" || text === "browse" || text.includes("product")) {
      await showCategories(phone, lang);
      return;
    }
    if (text === "2" || text === "track") {
      setSession(phone, { step: "track" });
      await sendWhatsApp({ to: phone, text: "Please enter your order number (e.g. ORD-ABC123):" });
      return;
    }
    if (text === "3" || text === "cart") {
      await showCart(phone, lang);
      return;
    }
    if (text === "4" || text === "checkout") {
      await startCheckout(phone, lang);
      return;
    }
    if (text === "5" || text === "support") {
      await sendWhatsApp({
        to: phone,
        text: `💬 Support\n\n📱 ${process.env.SUPPORT_PHONE || "+256700000000"}\n📧 support@ugsex.com\n\n${t("backToMenu", lang)}`,
      });
      return;
    }
    if (text === "6" || text === "language") {
      setSession(phone, { step: "lang_select" });
      await sendWhatsApp({ to: phone, text: t("langSelect", lang) });
      return;
    }
  }

  // ── Category browsing ──
  if (session.step === "categories") {
    const categories = await prisma.category.findMany({ take: 8, orderBy: { name: "asc" } });
    const idx = parseInt(text) - 1;
    if (idx >= 0 && idx < categories.length) {
      const category = categories[idx];
      await showProducts(phone, category.id, category.name, lang);
      return;
    }
  }

  // ── Product listing ──
  if (session.step === "products" && session.data.categoryId) {
    const page = session.data.page || 0;
    const categoryId = session.data.categoryId;

    if (text.toLowerCase() === "next" || text.toLowerCase() === "n") {
      const category = await prisma.category.findUnique({ where: { id: categoryId } });
      await showProducts(phone, categoryId, category?.name || "Products", lang, page + 1);
      return;
    }

    if (text.toLowerCase() === "prev" || text.toLowerCase() === "p" || text.toLowerCase() === "back") {
      if (page > 0) {
        const category = await prisma.category.findUnique({ where: { id: categoryId } });
        await showProducts(phone, categoryId, category?.name || "Products", lang, page - 1);
        return;
      }
    }

    if (text === "0") {
      await showCategories(phone, lang);
      return;
    }

    const pageSize = 8;
    const products = await prisma.product.findMany({
      where: { categoryId, status: "ACTIVE" },
      take: pageSize,
      skip: page * pageSize,
      orderBy: { featured: "desc" },
    });

    const idx = parseInt(text) - 1;
    if (idx >= 0 && idx < products.length) {
      const product = products[idx];
      await showProduct(phone, product, lang);
      return;
    }
  }

  // ── Add to cart (after viewing product) ──
  if (session.step === "product_detail" && session.data.productId) {
    const qty = parseInt(text);
    if (qty > 0 && qty <= 10) {
      const product = await prisma.product.findUnique({
        where: { id: session.data.productId },
        select: { id: true, name: true, price: true, stock: true },
      });
      if (product && product.stock >= qty) {
        const existingIdx = session.cart.findIndex(i => i.productId === product.id);
        const newCart = [...session.cart];
        if (existingIdx >= 0) {
          newCart[existingIdx].quantity += qty;
        } else {
          newCart.push({
            productId: product.id,
            name: product.name,
            price: Number(product.price),
            quantity: qty,
          });
        }
        setSession(phone, { cart: newCart, step: "menu" });
        const total = cartTotal(newCart);
        await sendWhatsApp({
          to: phone,
          text: t("addedToCart", lang, { qty, name: product.name, total: total.toLocaleString() }),
        });
        return;
      }
    }
    if (text === "0") {
      setSession(phone, { step: "menu" });
      await sendWhatsApp({ to: phone, text: t("welcome", lang, { count: session.cart.length }) });
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
      await sendWhatsApp({ to: phone, text: `Order "${orderNumber}" not found.\n\n${t("backToMenu", lang)}` });
    } else {
      const status = order.status.replace(/_/g, " ");
      await sendWhatsApp({
        to: phone,
        text: `📦 Order *${order.orderNumber}*\n\nStatus: *${status}*\nTotal: UGX ${Number(order.totalAmount).toLocaleString()}\n${order.trackingNumber ? `Tracking: ${order.trackingNumber}` : ""}\n\n${t("backToMenu", lang)}`,
      });
    }
    setSession(phone, { step: "menu" });
    return;
  }

  // ── Checkout flow ──
  if (session.step === "checkout_name") {
    setSession(phone, { step: "checkout_phone", shipping: { ...session.shipping, name: text } });
    await sendWhatsApp({ to: phone, text: "Enter delivery phone number:" });
    return;
  }
  if (session.step === "checkout_phone") {
    setSession(phone, { step: "checkout_street", shipping: { ...session.shipping, phone: text } });
    await sendWhatsApp({ to: phone, text: "Enter street address:" });
    return;
  }
  if (session.step === "checkout_street") {
    setSession(phone, { step: "checkout_city", shipping: { ...session.shipping, street: text } });
    await sendWhatsApp({ to: phone, text: "Enter city (e.g. Kampala):" });
    return;
  }
  if (session.step === "checkout_city") {
    setSession(phone, { step: "checkout_payment", shipping: { ...session.shipping, city: text } });
    await sendWhatsApp({
      to: phone,
      text: "Choose payment:\n1. MTN MoMo\n2. Airtel Money\n3. Cash on Delivery",
    });
    return;
  }
  if (session.step === "checkout_payment") {
    let paymentMethod = "";
    let network = "";
    if (text === "1" || text.includes("mtn")) { paymentMethod = "mobile_money"; network = "MTN"; }
    else if (text === "2" || text.includes("airtel")) { paymentMethod = "mobile_money"; network = "AIRTEL"; }
    else if (text === "3" || text.includes("cod") || text.includes("cash")) { paymentMethod = "cod"; }
    else {
      await sendWhatsApp({ to: phone, text: "Please reply 1, 2, or 3." });
      return;
    }

    if (paymentMethod === "mobile_money") {
      setSession(phone, { step: "checkout_momo_phone", data: { paymentMethod, network } });
      await sendWhatsApp({ to: phone, text: "Enter MoMo/Airtel phone number for payment:" });
      return;
    }

    // COD — go to confirm
    setSession(phone, { step: "checkout_confirm", data: { paymentMethod } });
    await showOrderSummary(phone, lang);
    return;
  }
  if (session.step === "checkout_momo_phone") {
    setSession(phone, { step: "checkout_confirm", data: { ...session.data, momoPhone: text } });
    await showOrderSummary(phone, lang);
    return;
  }
  if (session.step === "checkout_confirm") {
    if (text === "confirm" || text === "yes") {
      await placeWhatsAppOrder(phone, lang);
      return;
    }
    if (text === "back" || text === "edit") {
      await startCheckout(phone, lang);
      return;
    }
    await sendWhatsApp({ to: phone, text: "Reply *confirm* to place order or *back* to edit." });
    return;
  }

  // ── Cart management ──
  if (session.step === "cart_manage") {
    if (text === "clear") {
      setSession(phone, { cart: [], step: "menu" });
      await sendWhatsApp({ to: phone, text: "Cart cleared.\n\n" + t("backToMenu", lang) });
      return;
    }
    if (text === "checkout") {
      await startCheckout(phone, lang);
      return;
    }
    // Remove item by number
    const removeIdx = parseInt(text) - 1;
    if (removeIdx >= 0 && removeIdx < session.cart.length) {
      const newCart = [...session.cart];
      const removed = newCart.splice(removeIdx, 1)[0];
      setSession(phone, { cart: newCart, step: "menu" });
      await sendWhatsApp({ to: phone, text: `Removed ${removed.name} from cart.\n\n${t("backToMenu", lang)}` });
      return;
    }
  }

  // ── AI recommendations step ──
  if (session.step === "ai_recommendations" && session.data.ai_recommendations) {
    const idx = parseInt(text) - 1;
    const recs = session.data.ai_recommendations as Array<{ name: string; slug: string; price: number }>;
    if (idx >= 0 && idx < recs.length) {
      const product = await prisma.product.findFirst({
        where: { slug: recs[idx].slug },
        select: { id: true, name: true, price: true, stock: true },
      });
      if (product && product.stock > 0) {
        const newCart = [...session.cart, { productId: product.id, name: product.name, price: Number(product.price), quantity: 1 }];
        setSession(phone, { cart: newCart, step: "menu" });
        await sendWhatsApp({ to: phone, text: `✅ Added ${product.name} to your cart!\n\nReply *cart* to view your cart or *menu* for more options.` });
        return;
      }
    }
    setSession(phone, { step: "menu" });
    await sendWhatsApp({ to: phone, text: `Reply *menu* to see options or *browse* to shop.` });
    return;
  }

  // ── Default: AI Assistant ──
  const aiResponse = await generateAIResponse(phone, text, {
    cart: session.cart.map(i => ({ name: i.name, price: i.price })),
    language: lang,
  });

  if (aiResponse) {
    let reply = aiResponse.text;

    if (aiResponse.products && aiResponse.products.length > 0) {
      setSession(phone, {
        step: "ai_recommendations",
        data: { ai_recommendations: aiResponse.products },
      });
      reply += "\n\nReply with a number to add to cart.";
    }

    await sendWhatsApp({ to: phone, text: reply });
  } else {
    await sendWhatsApp({
      to: phone,
      text: `Sorry, I didn't understand that. Reply *menu* to see options, or *browse* to shop. 🛍️`,
    });
  }
}

async function showCategories(phone: string, lang: string): Promise<void> {
  const categories = await prisma.category.findMany({ take: 8, orderBy: { name: "asc" } });
  setSession(phone, { step: "categories", data: { categories: categories.map(c => c.id) } });

  const list = categories.map((c, i) => `${i + 1}️⃣ ${c.name}`).join("\n");
  await sendWhatsApp({
    to: phone,
    text: `🛍️ *Browse by Category*\n\n${list}\n\nReply with a number, or *menu* to go back.`,
  });
}

async function showProducts(phone: string, categoryId: string, categoryName: string, lang: string, page: number = 0): Promise<void> {
  const pageSize = 8;
  const products = await prisma.product.findMany({
    where: { categoryId, status: "ACTIVE" },
    take: pageSize,
    skip: page * pageSize,
    orderBy: { featured: "desc" },
  });

  const totalProducts = await prisma.product.count({
    where: { categoryId, status: "ACTIVE" },
  });

  const hasNext = (page + 1) * pageSize < totalProducts;
  const hasPrev = page > 0;

  setSession(phone, { step: "products", data: { categoryId, page } });

  if (products.length === 0) {
    await sendWhatsApp({ to: phone, text: `No products in ${categoryName} right now.\n\nReply *browse* to pick another category.` });
    return;
  }

  const list = products.map((p, i) =>
    `${i + 1}️⃣ ${p.name} — UGX ${Number(p.price).toLocaleString()}`
  ).join("\n");

  let navigationOptions = "";
  if (hasNext && hasPrev) {
    navigationOptions = "\n\nReply with a number, *next* for more, *prev* for previous, or *0* to go back.";
  } else if (hasNext) {
    navigationOptions = "\n\nReply with a number, *next* for more, or *0* to go back.";
  } else if (hasPrev) {
    navigationOptions = "\n\nReply with a number, *prev* for previous, or *0* to go back.";
  } else {
    navigationOptions = "\n\nReply with a number, or *0* to go back.";
  }

  await sendWhatsApp({
    to: phone,
    text: `*${categoryName}* (Page ${page + 1})\n\n${list}${navigationOptions}`,
  });
}

async function showProduct(phone: string, product: any, lang: string): Promise<void> {
  const url = `${process.env.FRONTEND_URL}/product/${product.slug}`;
  await sendWhatsApp({
    to: phone,
    text: `*${product.name}*\n💰 UGX ${Number(product.price).toLocaleString()}\n${product.stock > 0 ? "✅ In stock" : "❌ Out of stock"}\n\n${product.description ? product.description.slice(0, 150) + "..." : ""}\n\n🔒 Plain packaging, discreet delivery\n\n📱 Type a quantity (1-10) to add to cart\nOr type *0* to go back\n\n🔗 View online: ${url}`,
  });
  setSession(phone, { step: "product_detail", data: { productId: product.id } });
}

async function showCart(phone: string, lang: string): Promise<void> {
  const session = getSession(phone);
  if (session.cart.length === 0) {
    await sendWhatsApp({ to: phone, text: t("emptyCart", lang) });
    return;
  }

  setSession(phone, { step: "cart_manage" });

  const list = session.cart.map((item, i) =>
    `${i + 1}. ${item.name} ×${item.quantity} — UGX ${(item.price * item.quantity).toLocaleString()}`
  ).join("\n");

  const total = cartTotal(session.cart);

  await sendWhatsApp({
    to: phone,
    text: `🛒 *Your Cart*\n\n${list}\n\n💰 Total: UGX ${total.toLocaleString()}\n\nType item number to remove\nType *checkout* to buy\nType *clear* to empty cart\nType *0* to go back`,
  });
}

async function startCheckout(phone: string, lang: string): Promise<void> {
  const session = getSession(phone);
  if (session.cart.length === 0) {
    await sendWhatsApp({ to: phone, text: t("emptyCart", lang) });
    return;
  }
  setSession(phone, { step: "checkout_name", shipping: {} });
  await sendWhatsApp({ to: phone, text: "Let's checkout! Enter recipient name:" });
}

async function showOrderSummary(phone: string, lang: string): Promise<void> {
  const session = getSession(phone);
  const total = cartTotal(session.cart);
  const items = session.cart.map(i => `  ${i.name} ×${i.quantity} — UGX ${(i.price * i.quantity).toLocaleString()}`).join("\n");
  const paymentLabel = session.data.paymentMethod === "cod" ? "Cash on Delivery" : `Mobile Money (${session.data.network})`;

  await sendWhatsApp({
    to: phone,
    text: `📋 *Order Summary*\n\n${items}\n\n💰 Total: UGX ${total.toLocaleString()}\n\n📬 Ship to:\n  ${session.shipping.name}\n  ${session.shipping.street}, ${session.shipping.city}\n  📱 ${session.shipping.phone}\n\n💳 Payment: ${paymentLabel}\n\nReply *confirm* to place order or *back* to edit.`,
  });
}

async function placeWhatsAppOrder(phone: string, lang: string): Promise<void> {
  const session = getSession(phone);

  try {
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const total = cartTotal(session.cart);

    // Fetch products to verify prices
    const productIds = session.cart.map(i => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map(p => [p.id, p]));

    const order = await prisma.$transaction(async (tx) => {
      // 1. Verify price mappings and build items payload
      const orderItems = session.cart.map(item => {
        const p = productMap.get(item.productId);
        if (!p) throw new Error(`Product not found: ${item.name}`);
        return {
          productId: item.productId,
          quantity: item.quantity,
          price: Number(p.price),
          name: p.name,
          sellerId: p.sellerId || null,
        };
      });

      // 2. Create the order record
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          subtotal: total,
          totalAmount: total,
          shippingCost: 0,
          currency: "UGX",
          status: session.data.paymentMethod === "cod" ? "CONFIRMED" : "PENDING",
          discreet: true,
          customerName: session.shipping.name || "WhatsApp Customer",
          customerEmail: phone,
          customerPhone: session.shipping.phone || phone,
          shippingAddress: JSON.stringify({
            name: session.shipping.name,
            street: session.shipping.street,
            city: session.shipping.city,
            phone: session.shipping.phone,
          }),
          guestDataExpiresAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
          items: {
            create: orderItems,
          },
        },
      });

      // 3. Handle stock management
      if (session.data.paymentMethod === "cod") {
        // Direct stock decrement for confirmed Cash on Delivery orders
        for (const item of session.cart) {
          const product = productMap.get(item.productId);
          if (product && product.trackInventory) {
            // Lock row to prevent TOCTOU race
            const [dbProduct] = await tx.$queryRaw<any[]>`
              SELECT stock, "allowBackorder" FROM "Product" WHERE id = ${item.productId} FOR UPDATE`;
            if (dbProduct && dbProduct.stock < item.quantity && !dbProduct.allowBackorder) {
              throw new Error(`Insufficient stock for ${item.name}. Available: ${dbProduct.stock}`);
            }
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { decrement: item.quantity } },
            });
          }
        }
      } else {
        // Create stock reservations for pending Mobile Money orders (released on webhook confirmation)
        const { reserveStock } = await import("../utils/stockReservation");
        const reserveItems = session.cart.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          product: { name: item.name },
          variantId: null,
        }));
        const stockResult = await reserveStock(tx, reserveItems, newOrder.id);
        if (!stockResult.success) {
          throw new Error(stockResult.error || "Failed to reserve stock");
        }
      }

      return newOrder;
    });

    // Create payment record
    if (session.data.paymentMethod === "cod") {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          provider: "cod",
          method: "COD",
          status: "PENDING",
          amount: total,
          currency: "UGX",
        },
      });

      // Clear cart
      setSession(phone, { cart: [], step: "menu", shipping: {} });

      await sendWhatsApp({
        to: phone,
        text: `✅ *Order Placed!*\n\n🔢 Order #: *${orderNumber}*\n💰 Total: UGX ${total.toLocaleString()}\n💳 Cash on Delivery\n\nWe'll deliver in discreet packaging. 🔒\n\nReply *menu* for main menu.`,
      });
    } else {
      // Mobile Money payment - direct charge prompt (STK Push)
      try {
        let momoPhone = session.data.momoPhone || phone;
        let cleanedPhone = momoPhone.replace(/[^0-9]/g, "");
        if (cleanedPhone.startsWith("07")) {
          cleanedPhone = "256" + cleanedPhone.slice(1);
        } else if (cleanedPhone.startsWith("7")) {
          cleanedPhone = "256" + cleanedPhone;
        }

        const paymentResponse = await chargeMobileMoneyUganda({
          tx_ref: order.id,
          amount: total,
          currency: "UGX",
          email: `${phone.replace(/[^0-9]/g, "")}@whatsapp.ugsex.com`,
          phone_number: cleanedPhone,
          network: (session.data.network === "AIRTEL" ? "AIRTEL" : "MTN") as "MTN" | "AIRTEL",
          fullname: session.shipping.name || "WhatsApp Customer",
        });

        await prisma.payment.create({
          data: {
            orderId: order.id,
            provider: "flutterwave",
            method: "MOBILE_MONEY",
            status: "PENDING",
            amount: total,
            currency: "UGX",
            flwRef: paymentResponse.data?.flw_ref || paymentResponse.data?.id?.toString(),
          },
        });

        // Clear cart
        setSession(phone, { cart: [], step: "menu", shipping: {} });

        await sendWhatsApp({
          to: phone,
          text: `📱 *Payment Initiated*\n\n🔢 Order #: *${orderNumber}*\n💰 Total: UGX ${total.toLocaleString()}\n\nCheck your ${session.data.network} phone for the payment prompt. Enter your PIN to approve and complete your order.\n\nReply *menu* for main menu.`,
        });
      } catch (payErr: any) {
        await sendWhatsApp({
          to: phone,
          text: `Payment failed: ${payErr.message || "Please try again"}. Your order ${orderNumber} is saved. Reply *menu* to try again.`,
        });
      }
    }
  } catch (error) {
    logger.error("WhatsApp order error", { error });
    await sendWhatsApp({
      to: phone,
      text: "Sorry, something went wrong placing your order. Please try again or reply *support* for help.",
    });
  }
}

export default router;
