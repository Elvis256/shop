/**
 * Customer-facing Telegram bot — "Ug Connect" (@Ugconnectbot).
 *
 * Runs as its own PM2 process (`shop-telegram-bot`) for fault isolation: a
 * crash here won't take down the main API. Long-polls Telegram so we don't
 * need to expose a public webhook.
 *
 * Token + handle come from env (mirrored from /etc/shop-alerts/telegram-customer.env).
 * Required: TELEGRAM_CUSTOMER_BOT_TOKEN.
 */
import "../lib/validateEnv"; // dotenv + zod validation — must run first
import { Bot, GrammyError, HttpError, session } from "grammy";
import prisma from "../lib/prisma";
import redis from "../lib/redis";
import { logger } from "../lib/logger";
import type { BotContext, BotSessionData } from "./lib/context";
import { redisSessionStorage } from "./lib/sessionStorage";
import { loadUser } from "./middleware/loadUser";
import { ageGate } from "./middleware/ageGate";
import { basicCommands } from "./commands/basic";
import { linkCommands } from "./commands/link";
import { shopCommands, registerInlineQuery } from "./commands/shop";
import { cartCommands } from "./commands/cart";
import { ordersCommands } from "./commands/orders";
import { t } from "./lib/i18n";

// Crash safety — match backend's index.ts pattern.
process.on("unhandledRejection", (reason) => {
  logger.error("bot_unhandled_rejection", { error: String(reason) });
});
process.on("uncaughtException", (err) => {
  logger.error("bot_uncaught_exception", { error: err.message, stack: err.stack });
  setTimeout(() => process.exit(1), 1000);
});

const token = process.env.TELEGRAM_CUSTOMER_BOT_TOKEN;
if (!token) {
  // Env validation marks the var optional (so the main backend still runs
  // without it), but the bot process can't.
  logger.error("bot_missing_token", {
    error: "TELEGRAM_CUSTOMER_BOT_TOKEN is required to run shop-telegram-bot",
  });
  process.exit(1);
}

export const bot = new Bot<BotContext>(token);

// --- Middleware pipeline ---------------------------------------------------

// 1. Session: per-chat conversational state (Redis-backed, in-memory fallback).
bot.use(
  session({
    initial: (): BotSessionData => ({}),
    storage: redisSessionStorage,
    getSessionKey: (ctx) => ctx.chat ? String(ctx.chat.id) : undefined,
  })
);

// 2. Load (or create) the TelegramUser row → attach to ctx.tgUser.
bot.use(loadUser);

// 3. Age gate (18+ confirmation). Blocks everything except the age-gate
//    callback itself until accepted.
bot.use(ageGate);

// --- Handlers --------------------------------------------------------------

bot.use(basicCommands);
bot.use(linkCommands);
bot.use(shopCommands);
bot.use(cartCommands);
bot.use(ordersCommands);
registerInlineQuery(bot);

// Catch-all for anything that didn't match a handler above.
bot.on("message", async (ctx) => {
  // Don't spam users mid-flow — the flow handlers will respond.
  if (ctx.session.flow) return;
  await ctx.reply(t("en", "unknown"));
});

// --- Error handling --------------------------------------------------------

bot.catch((err) => {
  const ctx = err.ctx;
  const update = ctx.update.update_id;
  if (err.error instanceof GrammyError) {
    logger.error("bot_grammy_error", {
      update,
      description: err.error.description,
      method: err.error.method,
    });
  } else if (err.error instanceof HttpError) {
    logger.error("bot_http_error", { update, error: err.error.message });
  } else {
    logger.error("bot_unhandled_error", {
      update,
      error: (err.error as Error)?.message ?? String(err.error),
      stack: (err.error as Error)?.stack,
    });
  }
});

// --- Lifecycle -------------------------------------------------------------

async function main(): Promise<void> {
  // Publish the public command list to Telegram so users see them in the menu.
  await bot.api
    .setMyCommands([
      { command: "start", description: "Open the main menu" },
      { command: "shop", description: "Browse products" },
      { command: "search", description: "Search products" },
      { command: "cart", description: "View your shopping cart" },
      { command: "orders", description: "Your recent orders" },
      { command: "track", description: "Track an order by number" },
      { command: "link", description: "Link your ugsex.com account" },
      { command: "unlink", description: "Disconnect from your account" },
      { command: "privacy", description: "How we handle your data" },
      { command: "delete", description: "Wipe your bot record" },
      { command: "help", description: "Show command list" },
      { command: "cancel", description: "Cancel the current action" },
    ])
    .catch((err) => {
      logger.warn("bot_set_commands_failed", { error: err?.message });
    });

  const me = await bot.api.getMe();
  logger.info("bot_starting", {
    username: me.username,
    id: me.id,
    can_join_groups: me.can_join_groups,
  });

  // start() is blocking — runs until SIGTERM/SIGINT.
  await bot.start({
    drop_pending_updates: true,
    onStart: (info) => {
      logger.info("bot_polling", { username: info.username });
    },
  });
}

async function shutdown(signal: string): Promise<void> {
  logger.info("bot_shutdown_initiated", { signal });
  try {
    await bot.stop();
  } catch (err: any) {
    logger.error("bot_shutdown_stop_failed", { error: err?.message });
  }
  await prisma.$disconnect().catch(() => {});
  await redis.quit().catch(() => {});
  logger.info("bot_shutdown_complete");
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

main().catch((err) => {
  logger.error("bot_startup_failed", { error: err?.message, stack: err?.stack });
  process.exit(1);
});
