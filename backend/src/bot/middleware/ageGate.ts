import type { NextFunction } from "grammy";
import { InlineKeyboard } from "grammy";
import prisma from "../../lib/prisma";
import { logger } from "../../lib/logger";
import type { BotContext } from "../lib/context";
import { t } from "../lib/i18n";

/**
 * 18+ confirmation. Until the customer taps "I'm 18+", every message gets the
 * age prompt instead of going to handlers.
 *
 * Bypass: the callback queries from the prompt itself (data starts with `age:`)
 * — otherwise the user could never answer.
 */

const ACCEPT_DATA = "age:accept";
const DECLINE_DATA = "age:decline";

export function ageGateKeyboard() {
  return new InlineKeyboard()
    .text(t("en", "ageGateAccept"), ACCEPT_DATA)
    .text(t("en", "ageGateDecline"), DECLINE_DATA);
}

export async function ageGate(ctx: BotContext, next: NextFunction): Promise<void> {
  // Always allow the callback that resolves the gate.
  if (ctx.callbackQuery?.data?.startsWith("age:")) {
    await handleAgeCallback(ctx);
    return;
  }

  if (ctx.tgUser?.ageVerified) {
    await next();
    return;
  }

  await ctx.reply(t("en", "ageGatePrompt"), {
    parse_mode: "Markdown",
    reply_markup: ageGateKeyboard(),
  });
}

async function handleAgeCallback(ctx: BotContext): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data || !ctx.tgUser) {
    await ctx.answerCallbackQuery().catch(() => {});
    return;
  }

  if (data === ACCEPT_DATA) {
    try {
      await prisma.telegramUser.update({
        where: { id: ctx.tgUser.id },
        data: {
          ageVerified: true,
          ageVerifiedAt: new Date(),
          // First acceptance also implies acknowledging privacy notice.
          privacyAcceptedAt: ctx.tgUser.privacyAcceptedAt ?? new Date(),
        },
      });
    } catch (err: any) {
      logger.error("bot_age_accept_failed", {
        chatId: String(ctx.tgUser.telegramChatId),
        error: err?.message,
      });
      await ctx.answerCallbackQuery({ text: "Error — try again." }).catch(() => {});
      return;
    }
    await ctx.answerCallbackQuery({ text: "Confirmed" }).catch(() => {});
    // Remove inline buttons so the user can't double-click.
    await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {});
    await ctx.reply(t("en", "ageGateAccepted"), { parse_mode: "Markdown" });
    await ctx.reply(t("en", "privacyShort"), { parse_mode: "Markdown" });
    return;
  }

  if (data === DECLINE_DATA) {
    await ctx.answerCallbackQuery().catch(() => {});
    await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {});
    await ctx.reply(t("en", "ageGateDeclined"));
    return;
  }
}
