import { Composer, InlineKeyboard } from "grammy";
import prisma from "../../lib/prisma";
import { logger } from "../../lib/logger";
import type { BotContext } from "../lib/context";
import { t } from "../lib/i18n";
import {
  getParentCategories,
  getProductsByCategory,
  searchProducts,
  getProductById,
  getAffiliateCode,
} from "../lib/productsService";
import { formatCurrency, escapeHtml } from "../lib/format";

export const shopCommands = new Composer<BotContext>();

// Helper to delete the previous message and send a new one (e.g. for card navigation to/from photo messages)
async function deleteAndReply(
  ctx: BotContext,
  text: string,
  options: any,
  photoUrl?: string | null
) {
  try {
    await ctx.deleteMessage().catch(() => {});
  } catch (err) {}

  if (photoUrl) {
    await ctx.replyWithPhoto(photoUrl, { caption: text, ...options });
  } else {
    await ctx.reply(text, options);
  }
}

// Renders the top-level categories list
async function renderCategories(ctx: BotContext, edit = false) {
  const categories = await getParentCategories();
  const locale = ctx.tgUser.languageCode as any || "en";

  if (categories.length === 0) {
    const text = t(locale, "shopNoCategories");
    if (edit) {
      await ctx.editMessageText(text).catch(() => {});
    } else {
      await ctx.reply(text);
    }
    return;
  }

  const text = t(locale, "shopCategorySelect");
  const keyboard = new InlineKeyboard();
  for (const cat of categories) {
    const count = cat._count.products;
    keyboard.text(`${cat.name} (${count})`, `shop:cat:${cat.id}`).row();
  }

  if (edit) {
    await ctx.editMessageText(text, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    }).catch(() => {});
  } else {
    await ctx.reply(text, { parse_mode: "Markdown", reply_markup: keyboard });
  }
}

// Renders product list for a category
async function renderProductsByCategory(
  ctx: BotContext,
  categoryId: string,
  page: number,
  edit = false
) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
  });
  if (!category) {
    await ctx.reply("Category not found.");
    return;
  }

  const limit = 5;
  const { products, total } = await getProductsByCategory(
    categoryId,
    page,
    limit
  );
  const totalPages = Math.ceil(total / limit);
  const locale = ctx.tgUser.languageCode as any || "en";

  if (products.length === 0) {
    const text = t(locale, "shopNoProducts");
    const keyboard = new InlineKeyboard().text("🏠 Categories", "shop:cats");
    if (edit) {
      await ctx.editMessageText(text, { reply_markup: keyboard }).catch(() => {});
    } else {
      await ctx.reply(text, { reply_markup: keyboard });
    }
    return;
  }

  const text = t(locale, "shopProductsHeader", {
    category: category.name,
    page,
    totalPages: totalPages || 1,
  });

  const keyboard = new InlineKeyboard();
  products.forEach((p) => {
    const priceStr = formatCurrency(p.price, p.currency);
    keyboard.text(`${p.name} - ${priceStr}`, `shop:prod:${p.id}`).row();
  });

  const paginationRow: any[] = [];
  if (page > 0) {
    paginationRow.push({
      text: "⬅️ Previous",
      callback_data: `shop:cat_page:${page - 1}`,
    });
  }
  if (page < totalPages - 1) {
    paginationRow.push({
      text: "Next ➡️",
      callback_data: `shop:cat_page:${page + 1}`,
    });
  }
  if (paginationRow.length > 0) {
    keyboard.row(...paginationRow);
  }

  keyboard.text("🏠 Categories", "shop:cats");

  if (edit) {
    await ctx.editMessageText(text, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    }).catch(() => {});
  } else {
    await ctx.reply(text, { parse_mode: "Markdown", reply_markup: keyboard });
  }
}

// Renders search results
async function renderSearchResults(
  ctx: BotContext,
  query: string,
  page: number,
  edit = false
) {
  const limit = 5;
  const { products, total } = await searchProducts(query, page, limit);
  const totalPages = Math.ceil(total / limit);
  const locale = ctx.tgUser.languageCode as any || "en";

  if (products.length === 0) {
    const text = t(locale, "searchNoResults", { query });
    const keyboard = new InlineKeyboard().text(
      "🏠 Shop Categories",
      "shop:cats"
    );
    if (edit) {
      await ctx.editMessageText(text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      }).catch(() => {});
    } else {
      await ctx.reply(text, { parse_mode: "Markdown", reply_markup: keyboard });
    }
    return;
  }

  const text = t(locale, "searchResultsHeader", {
    query,
    page,
    totalPages: totalPages || 1,
  });

  const keyboard = new InlineKeyboard();
  products.forEach((p) => {
    const priceStr = formatCurrency(p.price, p.currency);
    keyboard.text(`${p.name} - ${priceStr}`, `shop:prod:${p.id}`).row();
  });

  const paginationRow: any[] = [];
  if (page > 0) {
    paginationRow.push({
      text: "⬅️ Previous",
      callback_data: `shop:search_page:${page - 1}`,
    });
  }
  if (page < totalPages - 1) {
    paginationRow.push({
      text: "Next ➡️",
      callback_data: `shop:search_page:${page + 1}`,
    });
  }
  if (paginationRow.length > 0) {
    keyboard.row(...paginationRow);
  }

  keyboard.text("🏠 Shop Categories", "shop:cats");

  if (edit) {
    await ctx.editMessageText(text, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    }).catch(() => {});
  } else {
    await ctx.reply(text, { parse_mode: "Markdown", reply_markup: keyboard });
  }
}

// Renders the product details card (with deleteAndReply to handle photo media transitions)
async function renderProductDetail(ctx: BotContext, productId: string) {
  const product = await getProductById(productId);
  if (!product) {
    await ctx.reply("Product not found.");
    return;
  }

  const affiliateCode = await getAffiliateCode(ctx.tgUser.userId);
  const refParam = affiliateCode ? `?ref=${affiliateCode}` : "";
  const baseUrl = process.env.FRONTEND_URL || "https://ugsex.com";
  const productLink = `${baseUrl}/product/${product.slug}${refParam}`;
  const twaProductLink = `${baseUrl}/twa?search=${encodeURIComponent(product.name)}${affiliateCode ? `&ref=${affiliateCode}` : ""}`;

  const nameHtml = `<b>${escapeHtml(product.name)}</b>`;
  const badgeHtml = product.badgeText
    ? `🔥 <b>${escapeHtml(product.badgeText)}</b>\n`
    : "";
  const priceHtml =
    `💰 <b>Price:</b> ${formatCurrency(product.price, product.currency)}` +
    (product.comparePrice
      ? ` (<s>${formatCurrency(
          product.comparePrice,
          product.currency
        )}</s>)`
      : "");
  const stockHtml = `📦 <b>Availability:</b> ${
    product.stock > 0 ? "✅ In Stock" : "❌ Out of Stock"
  }`;
  const shippingHtml = `🚚 <b>Delivery:</b> ${
    product.cjProductId || product.aliexpressProductId
      ? "From Abroad (Express)"
      : "Express Delivery"
  }`;

  const descHtml = product.description
    ? `\n\n${escapeHtml(product.description.slice(0, 500))}${
        product.description.length > 500 ? "..." : ""
      }`
    : "";

  const captionText = `${nameHtml}\n${badgeHtml}${priceHtml}\n${stockHtml}\n${shippingHtml}${descHtml}`;

  const keyboard = new InlineKeyboard()
    .webApp("🛍️ View in App", twaProductLink)
    .url("🔗 View on Website", productLink)
    .row()
    .text("🛒 Add to Cart", `cart:add:${product.id}`)
    .text("🛍️ View Cart", "cart:view")
    .row()
    .text("🔙 Back", "shop:back");

  // Resolve relative image URLs to absolute so Telegram can fetch them.
  let imageUrl: string | null = product.images[0]?.url || null;
  if (imageUrl && !imageUrl.startsWith("http")) {
    const siteBase = (process.env.FRONTEND_URL || "https://ugsex.com").replace(/\/$/, "");
    imageUrl = `${siteBase}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
  }

  await deleteAndReply(
    ctx,
    captionText,
    {
      parse_mode: "HTML",
      reply_markup: keyboard,
    },
    imageUrl
  );
}

// Register commands
shopCommands.command("shop", async (ctx) => {
  ctx.session.flow = undefined;
  ctx.session.flowData = undefined;
  const baseUrl = process.env.FRONTEND_URL || "https://ugsex.com";
  const keyboard = new InlineKeyboard().webApp("🛍️ Open Storefront", `${baseUrl}/twa`);
  await ctx.reply("Tap the button below to open the PleasureZone Mini App storefront:", {
    reply_markup: keyboard,
  });
});

shopCommands.callbackQuery("menu:shop", async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  ctx.session.flow = undefined;
  ctx.session.flowData = undefined;
  const baseUrl = process.env.FRONTEND_URL || "https://ugsex.com";
  const keyboard = new InlineKeyboard().webApp("🛍️ Open Storefront", `${baseUrl}/twa`);
  await ctx.reply("Tap the button below to open the PleasureZone Mini App storefront:", {
    reply_markup: keyboard,
  });
});

shopCommands.command("search", async (ctx) => {
  ctx.session.flow = undefined;
  const query = ctx.match?.trim();
  const locale = ctx.tgUser.languageCode as any || "en";

  if (!query) {
    await ctx.reply(t(locale, "searchPrompt"), { parse_mode: "Markdown" });
    return;
  }

  ctx.session.flowData = {
    lastView: "search_results",
    searchQuery: query,
    searchPage: 0,
  };
  await renderSearchResults(ctx, query, 0);
});

// Callbacks
shopCommands.callbackQuery("shop:cats", async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  ctx.session.flowData = { lastView: "categories" };
  // Since we might be transitioning back from a photo detail card, we use deleteAndReply
  // to ensure a clean text message is rendered instead of trying to edit media caption
  await deleteAndReply(ctx, t(ctx.tgUser.languageCode as any || "en", "shopCategorySelect"), {
    parse_mode: "Markdown",
    reply_markup: new InlineKeyboard(), // Temporary
  });
  await renderCategories(ctx, true);
});

shopCommands.callbackQuery(/^shop:cat:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  const categoryId = ctx.match[1];
  ctx.session.flowData = {
    lastView: "category_products",
    lastCategoryId: categoryId,
    currentCategoryPage: 0,
  };
  await renderProductsByCategory(ctx, categoryId, 0, false);
});

shopCommands.callbackQuery(/^shop:cat_page:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  const page = parseInt(ctx.match[1], 10);
  const flowData = ctx.session.flowData || {};
  const categoryId = flowData.lastCategoryId as string;
  if (!categoryId) return;

  flowData.currentCategoryPage = page;
  ctx.session.flowData = flowData;

  await renderProductsByCategory(ctx, categoryId, page, true);
});

shopCommands.callbackQuery(/^shop:search_page:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  const page = parseInt(ctx.match[1], 10);
  const flowData = ctx.session.flowData || {};
  const query = flowData.searchQuery as string;
  if (!query) return;

  flowData.searchPage = page;
  ctx.session.flowData = flowData;

  await renderSearchResults(ctx, query, page, true);
});

shopCommands.callbackQuery(/^shop:prod:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  const productId = ctx.match[1];
  await renderProductDetail(ctx, productId);
});

shopCommands.callbackQuery("shop:back", async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  const flowData = ctx.session.flowData || {};
  const lastView = flowData.lastView as string;

  if (lastView === "category_products") {
    const categoryId = flowData.lastCategoryId as string;
    const page = (flowData.currentCategoryPage as number) || 0;
    if (categoryId) {
      await deleteAndReply(ctx, "Loading products...", {
        reply_markup: new InlineKeyboard(),
      });
      await renderProductsByCategory(ctx, categoryId, page, false);
      return;
    }
  } else if (lastView === "search_results") {
    const query = flowData.searchQuery as string;
    const page = (flowData.searchPage as number) || 0;
    if (query) {
      await deleteAndReply(ctx, "Searching...", {
        reply_markup: new InlineKeyboard(),
      });
      await renderSearchResults(ctx, query, page, false);
      return;
    }
  }

  // Fallback to categories list
  ctx.session.flowData = { lastView: "categories" };
  await deleteAndReply(ctx, "Loading categories...", {
    reply_markup: new InlineKeyboard(),
  });
  await renderCategories(ctx, false);
});

// Listener for inline queries
export function registerInlineQuery(bot: any) {
  bot.on("inline_query", async (ctx: any) => {
    const query = ctx.inlineQuery.query.trim();

    // Check age verification
    const tgUser = await prisma.telegramUser.findUnique({
      where: { telegramChatId: BigInt(ctx.from.id) },
    });

    if (!tgUser || !tgUser.ageVerified) {
      await ctx.answerInlineQuery([], {
        switch_pm_text: "🔞 Age Verification Required - Tap Here",
        switch_pm_parameter: "age_gate",
      });
      return;
    }

    if (!query) {
      await ctx.answerInlineQuery([]);
      return;
    }

    try {
      const { products } = await searchProducts(query, 0, 10);
      const affiliateCode = await getAffiliateCode(tgUser.userId);
      const refParam = affiliateCode ? `?ref=${affiliateCode}` : "";
      const baseUrl = process.env.FRONTEND_URL || "https://ugsex.com";

      const results = products.map((p) => {
        const priceStr = formatCurrency(p.price, p.currency);
        const productLink = `${baseUrl}/product/${p.slug}${refParam}`;
        const desc = p.description ? p.description.slice(0, 100) : "";

        return {
          type: "article" as const,
          id: p.id,
          title: p.name,
          description: `${priceStr} - ${desc}`,
          thumb_url: p.images[0]?.url || undefined,
          input_message_content: {
            message_text: `<b>${escapeHtml(p.name)}</b>\n\n💰 <b>Price:</b> ${priceStr}\n\n${
              p.description ? escapeHtml(p.description.slice(0, 300)) : ""
            }\n\n🔗 <a href="${productLink}">View Product</a>`,
            parse_mode: "HTML" as const,
          },
          reply_markup: new InlineKeyboard().url("🔗 View Product", productLink),
        };
      });

      await ctx.answerInlineQuery(results);
    } catch (err: any) {
      logger.error("inline_query_failed", { error: err.message });
      await ctx.answerInlineQuery([]).catch(() => {});
    }
  });
}
