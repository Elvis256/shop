import { Composer, InlineKeyboard } from "grammy";
import prisma from "../../lib/prisma";
import { logger } from "../../lib/logger";
import type { BotContext } from "../lib/context";
import { t } from "../lib/i18n";
import { formatCurrency } from "../lib/format";

export const ordersCommands = new Composer<BotContext>();

// Helper to translate OrderStatus to a friendly label with emoji
function getFriendlyStatus(status: string): string {
  switch (status) {
    case "PENDING":
      return "⏳ Pending";
    case "CONFIRMED":
      return "✅ Confirmed";
    case "PROCESSING":
      return "⚙️ Processing";
    case "SHIPPED":
      return "🚚 Shipped";
    case "DELIVERED":
      return "📦 Delivered";
    case "CANCELLED":
      return "❌ Cancelled";
    case "REFUNDED":
      return "💵 Refunded";
    default:
      return status;
  }
}

// Helper to render the user's order list
async function renderOrdersList(ctx: BotContext, edit = false) {
  const locale = (ctx.tgUser.languageCode as any) || "en";
  const userId = ctx.tgUser.userId;

  if (!userId) {
    await ctx.reply(
      "🔗 *Account linking required*\n\nPlease link your ugsex.com account using /link first to view your recent orders.",
      { parse_mode: "Markdown" }
    );
    return;
  }

  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  if (orders.length === 0) {
    const text = t(locale, "ordersEmpty");
    if (edit) {
      await ctx.editMessageText(text).catch(() => {});
    } else {
      await ctx.reply(text);
    }
    return;
  }

  let text = t(locale, "ordersTitle");
  orders.forEach((order) => {
    text += t(locale, "ordersItemLine", {
      orderNumber: order.orderNumber,
      date: order.createdAt.toLocaleDateString(),
      status: getFriendlyStatus(order.status),
      total: formatCurrency(order.totalAmount, order.currency),
    });
  });

  const keyboard = new InlineKeyboard();
  orders.forEach((order) => {
    keyboard
      .text(
        t(locale, "ordersTrackButton", { orderNumber: order.orderNumber }),
        `order:track:${order.id}`
      )
      .row();
  });

  if (edit) {
    await ctx.editMessageText(text, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    }).catch(() => {});
  } else {
    await ctx.reply(text, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }
}

// Helper to render order tracking details
async function renderOrderTracking(ctx: BotContext, orderId: string, edit = false) {
  const locale = (ctx.tgUser.languageCode as any) || "en";

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      timeline: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!order) {
    await ctx.reply("Order not found.");
    return;
  }

  let text = t(locale, "orderTrackingTitle", {
    orderNumber: order.orderNumber,
    status: getFriendlyStatus(order.status),
  });

  if (order.trackingNumber) {
    text += t(locale, "orderTrackingDeliveryCode", { code: order.trackingNumber });
    text += "\n";
  }

  if (order.timeline && order.timeline.length > 0) {
    order.timeline.forEach((event) => {
      text += t(locale, "orderTrackingEvent", {
        date: event.createdAt.toLocaleString(),
        status: getFriendlyStatus(event.status),
        note: event.note || "",
      });
    });
  } else {
    text += t(locale, "orderTrackingNoEvents");
  }

  const keyboard = new InlineKeyboard();
  if (ctx.tgUser.userId) {
    keyboard.text("🔙 Back to Orders", "orders:list");
  }

  if (edit) {
    await ctx.editMessageText(text, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    }).catch(() => {});
  } else {
    await ctx.reply(text, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  }
}

// ─── COMMANDS ───────────────────────────────────────────────────────────────

ordersCommands.command("orders", async (ctx) => {
  ctx.session.flow = undefined;
  await renderOrdersList(ctx);
});

ordersCommands.callbackQuery("menu:orders", async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  ctx.session.flow = undefined;
  await renderOrdersList(ctx);
});

ordersCommands.command("track", async (ctx) => {
  ctx.session.flow = undefined;
  const orderNumber = ctx.match?.trim();
  const locale = (ctx.tgUser.languageCode as any) || "en";

  if (!orderNumber) {
    await ctx.reply(
      "🔍 *Track Order*\n\nPlease specify the order number, e.g. `/track ORD-12345`.",
      { parse_mode: "Markdown" }
    );
    return;
  }

  const order = await prisma.order.findFirst({
    where: {
      orderNumber: {
        contains: orderNumber,
        mode: "insensitive",
      },
    },
  });

  if (!order) {
    await ctx.reply(`❌ Order matching *"${orderNumber}"* was not found.`, {
      parse_mode: "Markdown",
    });
    return;
  }

  await renderOrderTracking(ctx, order.id);
});

// ─── CALLBACK QUERIES ────────────────────────────────────────────────────────

ordersCommands.callbackQuery("orders:list", async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  await renderOrdersList(ctx, true);
});

ordersCommands.callbackQuery(/^order:track:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  const orderId = ctx.match[1];
  await renderOrderTracking(ctx, orderId, true);
});
