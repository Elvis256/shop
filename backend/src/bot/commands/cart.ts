import { Composer, InlineKeyboard } from "grammy";
import prisma from "../../lib/prisma";
import { logger } from "../../lib/logger";
import type { BotContext } from "../lib/context";
import { t } from "../lib/i18n";
import { formatCurrency } from "../lib/format";
import { createFlutterwavePayment } from "../../services/flutterwave";
import {
  getCart,
  addToCart,
  updateQuantity,
  clearCart,
} from "../lib/cartService";

export const cartCommands = new Composer<BotContext>();

const SHIPPING_COST = 5000; // Flat UGX 5,000 for home delivery

interface CheckoutData {
  name?: string;
  phone?: string;
  street?: string;
  city?: string;
  paymentMethod?: "MTN" | "AIRTEL" | "cod";
  momoPhone?: string;
  addressId?: string;
}

// Helper to delete previous message and send a text message
async function deleteAndReply(ctx: BotContext, text: string, options: any) {
  try {
    await ctx.deleteMessage().catch(() => {});
  } catch (err) {}
  await ctx.reply(text, options);
}

// Helper to render the main cart view
async function renderCart(ctx: BotContext, edit = false, deletePrev = false) {
  const locale = (ctx.tgUser.languageCode as any) || "en";
  const cart = await getCart(ctx);

  if (cart.items.length === 0) {
    const text = t(locale, "cartEmpty");
    if (deletePrev) {
      await deleteAndReply(ctx, text, {});
    } else if (edit) {
      await ctx.editMessageText(text).catch(() => {});
    } else {
      await ctx.reply(text);
    }
    return;
  }

  let text = t(locale, "cartTitle");
  cart.items.forEach((item, index) => {
    text += t(locale, "cartItemLine", {
      name: item.product.name,
      quantity: item.quantity,
      price: formatCurrency(item.product.price, item.product.currency),
      total: formatCurrency(
        Number(item.product.price) * item.quantity,
        item.product.currency
      ),
    });
  });

  text += t(locale, "cartTotalLine", {
    total: formatCurrency(cart.subtotal, "UGX"),
  });
  text += t(locale, "cartInstruction");

  const keyboard = new InlineKeyboard();
  cart.items.forEach((item, index) => {
    keyboard
      .text(`${index + 1}️⃣ Edit ${item.product.name.slice(0, 15)}...`, `cart:edit:${item.productId}`)
      .row();
  });

  keyboard
    .text(t(locale, "cartClearButton"), "cart:clear")
    .text(t(locale, "cartCheckoutButton"), "cart:checkout")
    .row();

  const options = {
    parse_mode: "Markdown" as const,
    reply_markup: keyboard,
  };

  if (deletePrev) {
    await deleteAndReply(ctx, text, options);
  } else if (edit) {
    await ctx.editMessageText(text, options).catch(() => {});
  } else {
    await ctx.reply(text, options);
  }
}

// Helper to render the edit item view
async function renderCartEdit(ctx: BotContext, productId: string, edit = false, deletePrev = false) {
  const locale = (ctx.tgUser.languageCode as any) || "en";
  const cart = await getCart(ctx);
  const item = cart.items.find((i) => i.productId === productId);

  if (!item) {
    await ctx.answerCallbackQuery("Item not found in cart.").catch(() => {});
    await renderCart(ctx, edit, deletePrev);
    return;
  }

  let text = t(locale, "cartEditTitle", { name: item.product.name });
  text += t(locale, "cartEditInfo", {
    price: formatCurrency(item.product.price, item.product.currency),
    quantity: item.quantity,
    total: formatCurrency(
      Number(item.product.price) * item.quantity,
      item.product.currency
    ),
  });

  const keyboard = new InlineKeyboard()
    .text(t(locale, "cartDecButton"), `cart:set_qty:${productId}:${item.quantity - 1}`)
    .text(t(locale, "cartIncButton"), `cart:set_qty:${productId}:${item.quantity + 1}`)
    .row()
    .text(t(locale, "cartRemoveButton"), `cart:set_qty:${productId}:0`)
    .row()
    .text(t(locale, "cartBackButton"), "cart:view");

  const options = {
    parse_mode: "Markdown" as const,
    reply_markup: keyboard,
  };

  if (deletePrev) {
    await deleteAndReply(ctx, text, options);
  } else if (edit) {
    await ctx.editMessageText(text, options).catch(() => {});
  } else {
    await ctx.reply(text, options);
  }
}

// ─── COMMANDS ───────────────────────────────────────────────────────────────

cartCommands.command("cart", async (ctx) => {
  ctx.session.flow = undefined;
  await renderCart(ctx);
});

// ─── CALLBACK QUERIES ────────────────────────────────────────────────────────

cartCommands.callbackQuery("cart:view", async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  await renderCart(ctx, false, true);
});

cartCommands.callbackQuery(/^cart:add:(.+)$/, async (ctx) => {
  const productId = ctx.match[1];
  const locale = (ctx.tgUser.languageCode as any) || "en";

  const result = await addToCart(ctx, productId, 1);
  if (result.success) {
    await ctx.answerCallbackQuery({ text: t(locale, "cartAddSuccess") }).catch(() => {});
  } else {
    await ctx.answerCallbackQuery({ text: result.message || "Failed to add." }).catch(() => {});
  }
});

cartCommands.callbackQuery(/^cart:edit:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  const productId = ctx.match[1];
  await renderCartEdit(ctx, productId, true, false);
});

cartCommands.callbackQuery(/^cart:set_qty:(.+):(\d+)$/, async (ctx) => {
  const productId = ctx.match[1];
  const qty = parseInt(ctx.match[2], 10);
  const locale = (ctx.tgUser.languageCode as any) || "en";

  const result = await updateQuantity(ctx, productId, qty);
  if (result.success) {
    if (qty <= 0) {
      await ctx.answerCallbackQuery({ text: t(locale, "cartItemRemoved") }).catch(() => {});
      await renderCart(ctx, true, false);
    } else {
      await ctx.answerCallbackQuery({ text: "Quantity updated." }).catch(() => {});
      await renderCartEdit(ctx, productId, true, false);
    }
  } else {
    await ctx.answerCallbackQuery({ text: result.message || "Failed to update." }).catch(() => {});
  }
});

cartCommands.callbackQuery("cart:clear", async (ctx) => {
  const locale = (ctx.tgUser.languageCode as any) || "en";
  await clearCart(ctx);
  await ctx.answerCallbackQuery({ text: t(locale, "cartCleared") }).catch(() => {});
  await renderCart(ctx, true, false);
});

// ─── CHECKOUT WIZARD FLOW ───────────────────────────────────────────────────

async function askAddressList(ctx: BotContext) {
  const locale = (ctx.tgUser.languageCode as any) || "en";
  const userId = ctx.tgUser.userId;
  if (!userId) return;

  const addresses = await prisma.address.findMany({
    where: { userId },
  });

  const keyboard = new InlineKeyboard();
  addresses.forEach((addr) => {
    keyboard.text(`${addr.name} (${addr.city})`, `checkout:address:${addr.id}`).row();
  });
  keyboard.text(t(locale, "checkoutCustomAddressButton"), "checkout:custom_addr").row();
  keyboard.text("🔙 Back to Review", "checkout:back_to_review").row();

  await ctx.reply(t(locale, "checkoutSelectAddress"), {
    reply_markup: keyboard,
  });
}

async function startCheckoutFlow(ctx: BotContext) {
  const locale = (ctx.tgUser.languageCode as any) || "en";
  const cart = await getCart(ctx);

  if (cart.items.length === 0) {
    await ctx.reply(t(locale, "checkoutEmpty"));
    return;
  }

  const userId = ctx.tgUser.userId;
  if (userId) {
    // Linked user: check for saved addresses
    const addresses = await prisma.address.findMany({
      where: { userId },
    });

    if (addresses.length > 0) {
      // Find default address or fallback to first
      const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];

      // Auto-prefill and go directly to review screen! (2-click checkout)
      ctx.session.flowData = {
        checkout: {
          name: defaultAddr.name,
          phone: defaultAddr.phone,
          street: defaultAddr.street,
          city: defaultAddr.city,
          addressId: defaultAddr.id,
          paymentMethod: "cod", // Default
        },
      };

      await ctx.reply(
        "📝 *Checkout Started*\nAuto-selected your default address. Please review your order below:",
        { parse_mode: "Markdown" }
      );
      await renderOrderReview(ctx);
      return;
    }
  }

  // Not linked or no saved addresses: trigger single-field details flow
  ctx.session.flowData = { checkout: {} };
  ctx.session.flow = "checkout:awaiting-details";
  await ctx.reply(t(locale, "checkoutAwaitingDetails"), { parse_mode: "Markdown" });
}

cartCommands.callbackQuery("cart:checkout", async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  await startCheckoutFlow(ctx);
});

cartCommands.command("checkout", async (ctx) => {
  await startCheckoutFlow(ctx);
});

cartCommands.callbackQuery("checkout:change_address", async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  await askAddressList(ctx);
});

cartCommands.callbackQuery("checkout:change_payment", async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  await askPaymentMethod(ctx);
});

cartCommands.callbackQuery("checkout:back_to_review", async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  await renderOrderReview(ctx);
});

cartCommands.callbackQuery(/^checkout:address:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  const addressId = ctx.match[1];
  const address = await prisma.address.findUnique({
    where: { id: addressId },
  });

  if (!address) {
    await ctx.reply("Address not found. Please try entering a custom address.");
    return;
  }

  const checkout = (ctx.session.flowData?.checkout as CheckoutData) || {};
  checkout.name = address.name;
  checkout.phone = address.phone;
  checkout.street = address.street;
  checkout.city = address.city;
  checkout.addressId = address.id;

  if (ctx.session.flowData) {
    ctx.session.flowData.checkout = checkout;
  }

  await renderOrderReview(ctx);
});

cartCommands.callbackQuery("checkout:custom_addr", async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  const locale = (ctx.tgUser.languageCode as any) || "en";

  ctx.session.flowData = { checkout: {} };
  ctx.session.flow = "checkout:awaiting-details";
  await ctx.reply(t(locale, "checkoutAwaitingDetails"), { parse_mode: "Markdown" });
});

// Payment method selection
async function askPaymentMethod(ctx: BotContext) {
  const locale = (ctx.tgUser.languageCode as any) || "en";

  const keyboard = new InlineKeyboard()
    .text("📱 MTN MoMo", "checkout:payment:MTN")
    .text("📱 Airtel Money", "checkout:payment:AIRTEL")
    .row()
    .text("💵 Cash on Delivery", "checkout:payment:cod")
    .row()
    .text("🔙 Back to Review", "checkout:back_to_review").row();

  await ctx.reply(t(locale, "checkoutSelectPayment"), {
    reply_markup: keyboard,
  });
}

cartCommands.callbackQuery(/^checkout:payment:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  const method = ctx.match[1] as "MTN" | "AIRTEL" | "cod";

  const checkout = (ctx.session.flowData?.checkout as CheckoutData) || {};
  checkout.paymentMethod = method;

  if (ctx.session.flowData) {
    ctx.session.flowData.checkout = checkout;
  }

  if (method === "cod") {
    await renderOrderReview(ctx);
  } else {
    // Prompt for MoMo phone number
    ctx.session.flow = "checkout:awaiting-momo-phone";
    await ctx.reply(t((ctx.tgUser.languageCode as any) || "en", "checkoutAwaitingMomoPhone"));
  }
});

// Render final review screen
async function renderOrderReview(ctx: BotContext) {
  const locale = (ctx.tgUser.languageCode as any) || "en";
  const cart = await getCart(ctx);
  const checkout = (ctx.session.flowData?.checkout as CheckoutData) || {};

  if (cart.items.length === 0) {
    await ctx.reply(t(locale, "checkoutEmpty"));
    return;
  }

  let text = t(locale, "checkoutReviewTitle");
  text += t(locale, "checkoutReviewItems");

  cart.items.forEach((item) => {
    text += `• ${item.product.name} ×${item.quantity} - ${formatCurrency(
      Number(item.product.price) * item.quantity,
      item.product.currency
    )}\n`;
  });
  text += "\n";

  const total = cart.subtotal + SHIPPING_COST;
  const paymentLabel =
    checkout.paymentMethod === "cod"
      ? "Cash on Delivery"
      : `${checkout.paymentMethod} Mobile Money (${checkout.momoPhone})`;

  text += t(locale, "checkoutReviewSummary", {
    subtotal: formatCurrency(cart.subtotal, "UGX"),
    shipping: formatCurrency(SHIPPING_COST, "UGX"),
    total: formatCurrency(total, "UGX"),
    name: checkout.name || "",
    phone: checkout.phone || "",
    address: `${checkout.street}, ${checkout.city}`,
    payment: paymentLabel,
  });

  const keyboard = new InlineKeyboard()
    .text(t(locale, "checkoutConfirmButton"), "checkout:confirm")
    .row();

  if (ctx.tgUser.userId) {
    keyboard.text("✏️ Change Address", "checkout:change_address");
  } else {
    keyboard.text("✏️ Change Address", "checkout:custom_addr");
  }

  keyboard
    .text("💳 Change Payment", "checkout:change_payment")
    .row()
    .text(t(locale, "checkoutCancelButton"), "checkout:cancel");

  await ctx.reply(text, {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
}

// Place Order confirmation
cartCommands.callbackQuery("checkout:confirm", async (ctx) => {
  await ctx.answerCallbackQuery({ text: "Processing order..." }).catch(() => {});
  const locale = (ctx.tgUser.languageCode as any) || "en";
  const cart = await getCart(ctx);
  const checkout = (ctx.session.flowData?.checkout as CheckoutData) || {};

  if (cart.items.length === 0) {
    await ctx.reply(t(locale, "checkoutEmpty"));
    return;
  }

  try {
    const orderNumber = `ORD-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)
      .toUpperCase()}`;
    const total = cart.subtotal + SHIPPING_COST;

    const productIds = cart.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const shippingAddress = {
      name: checkout.name || "Telegram Customer",
      street: checkout.street || "",
      city: checkout.city || "",
      phone: checkout.phone || "",
      country: "Uganda",
    };

    // Create Order in DB
    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId: ctx.tgUser.userId || null,
        subtotal: cart.subtotal,
        totalAmount: total,
        shippingCost: SHIPPING_COST,
        currency: "UGX",
        status: checkout.paymentMethod === "cod" ? "CONFIRMED" : "PENDING",
        discreet: true,
        customerName: checkout.name || "Telegram Customer",
        customerEmail: ctx.tgUser.username
          ? `${ctx.tgUser.username}@telegram`
          : `${checkout.phone}@telegram`,
        customerPhone: checkout.phone || "",
        shippingAddress: JSON.stringify(shippingAddress),
        deliveryMethod: "HOME_DELIVERY",
        guestDataExpiresAt: ctx.tgUser.userId
          ? null
          : new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        items: {
          create: cart.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: Number(item.product.price),
            name: item.product.name,
            sellerId: productMap.get(item.productId)?.sellerId || null,
          })),
        },
      },
    });

    if (checkout.paymentMethod === "cod") {
      // Cash on Delivery
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

      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          status: "CONFIRMED",
          note: "Order placed via Telegram Bot (Cash on Delivery)",
        },
      });

      await clearCart(ctx);
      ctx.session.flow = undefined;
      ctx.session.flowData = undefined;

      await ctx.reply(
        t(locale, "checkoutSuccessCOD", {
          orderNumber: order.orderNumber,
          total: formatCurrency(total, "UGX"),
        }),
        { parse_mode: "Markdown" }
      );
    } else {
      // Mobile Money via Flutterwave
      const network = checkout.paymentMethod as "MTN" | "AIRTEL";
      const momoPhone = checkout.momoPhone || checkout.phone || "";

      try {
        const paymentResponse = await createFlutterwavePayment({
          tx_ref: order.id,
          amount: total,
          currency: "UGX",
          customer: {
            name: checkout.name || "Customer",
            email: ctx.tgUser.username
              ? `${ctx.tgUser.username}@telegram.com`
              : `${momoPhone}@telegram.com`,
          },
          paymentMethod: "mobile_money",
          mobileMoney: {
            network: network === "MTN" ? "MTN" : "AIRTEL",
            phone: momoPhone,
          },
          redirect_url: `${process.env.BASE_URL || "https://ugsex.com"}/checkout/confirm?orderId=${order.id}`,
        });

        await prisma.payment.create({
          data: {
            orderId: order.id,
            provider: "flutterwave",
            method: "MOBILE_MONEY",
            status: "PENDING",
            amount: total,
            currency: "UGX",
            flwRef: paymentResponse.data?.flw_ref,
          },
        });

        await prisma.orderEvent.create({
          data: {
            orderId: order.id,
            status: "PENDING",
            note: `Payment initiated via ${network} Mobile Money (${momoPhone})`,
          },
        });

        await clearCart(ctx);
        ctx.session.flow = undefined;
        ctx.session.flowData = undefined;

        const paymentLink = paymentResponse.data?.link;
        const keyboard = paymentLink
          ? new InlineKeyboard().url("💳 Pay Now", paymentLink)
          : undefined;

        await ctx.reply(
          t(locale, "checkoutSuccessMoMo", {
            orderNumber: order.orderNumber,
            total: formatCurrency(total, "UGX"),
            network,
          }) + (paymentLink ? "\n\nIf you do not receive the push prompt on your phone, click *Pay Now* to authorize it:" : ""),
          { 
            parse_mode: "Markdown",
            reply_markup: keyboard,
          }
        );
      } catch (payErr: any) {
        logger.error("bot_checkout_payment_failed", {
          orderId: order.id,
          error: payErr?.message,
        });

        await clearCart(ctx);
        ctx.session.flow = undefined;
        ctx.session.flowData = undefined;

        await ctx.reply(
          t(locale, "checkoutSuccessMoMoFailed", {
            orderNumber: order.orderNumber,
          }),
          { parse_mode: "Markdown" }
        );
      }
    }
  } catch (err: any) {
    logger.error("bot_checkout_db_failed", { error: err?.message });
    await ctx.reply(t(locale, "internalError"));
  }
});

cartCommands.callbackQuery("checkout:cancel", async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  const locale = (ctx.tgUser.languageCode as any) || "en";
  ctx.session.flow = undefined;
  ctx.session.flowData = undefined;
  await ctx.reply(t(locale, "checkoutCancelled"));
});

// ─── INTERACTIVE TEXT INPUT STEPS ───────────────────────────────────────────

cartCommands.on("message:text", async (ctx, next) => {
  const text = ctx.message.text.trim();
  if (text.startsWith("/")) return next(); // Delegate slash commands

  const flow = ctx.session.flow;
  if (!flow || !flow.startsWith("checkout:")) return next();

  const locale = (ctx.tgUser.languageCode as any) || "en";
  const checkout = (ctx.session.flowData?.checkout as CheckoutData) || {};

  if (flow === "checkout:awaiting-details") {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    let name = "";
    let phone = "";
    let street = "";
    let city = "Kampala";
    let valid = false;

    if (lines.length >= 3) {
      name = lines[0];
      phone = lines[1];
      street = lines[2];
      if (lines[3]) city = lines[3];
      valid = true;
    } else {
      const commas = text.split(",").map((c) => c.trim()).filter(Boolean);
      if (commas.length >= 3) {
        name = commas[0];
        phone = commas[1];
        street = commas[2];
        if (commas[3]) city = commas[3];
        valid = true;
      }
    }

    if (!valid) {
      await ctx.reply(t(locale, "checkoutDetailsInvalid"), { parse_mode: "Markdown" });
      return;
    }

    checkout.name = name;
    checkout.phone = phone;
    checkout.street = street;
    checkout.city = city;
    checkout.paymentMethod = "cod"; // Default

    if (ctx.session.flowData) ctx.session.flowData.checkout = checkout;
    ctx.session.flow = undefined;

    await askPaymentMethod(ctx);
  } else if (flow === "checkout:awaiting-momo-phone") {
    checkout.momoPhone = text;
    if (ctx.session.flowData) ctx.session.flowData.checkout = checkout;

    ctx.session.flow = undefined;
    await renderOrderReview(ctx);
  }
});
