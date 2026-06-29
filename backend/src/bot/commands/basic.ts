import { Composer, InlineKeyboard } from "grammy";
import prisma from "../../lib/prisma";
import { logger } from "../../lib/logger";
import type { BotContext } from "../lib/context";
import { t } from "../lib/i18n";
import { ageGateKeyboard } from "../middleware/ageGate";

/**
 * Foundation commands: /start /help /privacy /delete and a /cancel that
 * clears any in-progress flow from the session.
 */
export const basicCommands = new Composer<BotContext>();

basicCommands.command("start", async (ctx) => {
  // Clear any half-finished flow so /start is always a clean entry point.
  ctx.session.flow = undefined;
  ctx.session.flowData = undefined;

  if (!ctx.tgUser.ageVerified) {
    await ctx.reply(t("en", "ageGatePrompt"), {
      parse_mode: "Markdown",
      reply_markup: ageGateKeyboard(),
    });
    return;
  }

  const name = ctx.tgUser.firstName || ctx.from?.first_name || "there";
  const linkedLine = ctx.tgUser.userId
    ? "✅ Linked to your ugsex.com account."
    : "🔗 You haven't linked your ugsex.com account yet — tap *Link account* or send /link.";

  const keyboard = new InlineKeyboard()
    .webApp(t("en", "shopButton"), `${process.env.FRONTEND_URL || "https://ugsex.com"}/twa`)
    .text(t("en", "ordersButton"), "menu:orders")
    .row()
    .text(t("en", "linkButton"), "menu:link")
    .text(t("en", "supportButton"), "menu:support");

  await ctx.reply(
    `👋 Hi ${name} — welcome to *Ug Connect*.\n\n${linkedLine}\n\n` +
      "Browse, track orders, and reorder — all from Telegram. 🔒",
    { parse_mode: "Markdown", reply_markup: keyboard }
  );
});

basicCommands.command("help", async (ctx) => {
  await ctx.reply(`${t("en", "helpHeader")}\n\n${t("en", "helpBody")}`, {
    parse_mode: "Markdown",
  });
});

basicCommands.command("privacy", async (ctx) => {
  await ctx.reply(t("en", "privacyShort"), { parse_mode: "Markdown" });
});

basicCommands.command("cancel", async (ctx) => {
  const wasInFlow = !!ctx.session.flow;
  ctx.session.flow = undefined;
  ctx.session.flowData = undefined;
  await ctx.reply(
    wasInFlow ? "Cancelled. Send /help for the command list." : "Nothing to cancel."
  );
});

basicCommands.command("delete", async (ctx) => {
  const keyboard = new InlineKeyboard()
    .text(t("en", "deleteConfirmButton"), "delete:confirm")
    .text(t("en", "cancelButton"), "delete:cancel");
  await ctx.reply(t("en", "deleteConfirm"), {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
});

basicCommands.callbackQuery("delete:cancel", async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {});
  await ctx.reply("OK — nothing deleted.");
});

basicCommands.callbackQuery("delete:confirm", async (ctx) => {
  try {
    await prisma.telegramUser.delete({ where: { id: ctx.tgUser.id } });
  } catch (err: any) {
    logger.error("bot_delete_failed", {
      chatId: String(ctx.tgUser.telegramChatId),
      error: err?.message,
    });
    await ctx.answerCallbackQuery({ text: "Failed — try again." }).catch(() => {});
    return;
  }
  ctx.session.flow = undefined;
  ctx.session.flowData = undefined;
  await ctx.answerCallbackQuery({ text: "Deleted" }).catch(() => {});
  await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {});
  await ctx.reply(t("en", "deleteDone"));
});

// Menu button shortcuts — these just point users at the slash commands so we
// don't have to duplicate handler logic. /shop etc. are wired in their own
// command files (or stubbed for now).


basicCommands.callbackQuery("menu:link", async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  // Re-enter /link by delegating to the registered handler.
  await ctx.reply("Send /link to start linking your account.");
});

basicCommands.callbackQuery("menu:support", async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  await ctx.reply(
    "💬 *Support*\n\n" +
      "• Email: support@ugsex.com\n" +
      "• WhatsApp: send 'help' on the website's WhatsApp button\n" +
      "• Live chat is coming to this bot soon.",
    { parse_mode: "Markdown" }
  );
});
