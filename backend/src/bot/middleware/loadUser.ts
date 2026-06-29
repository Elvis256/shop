import type { NextFunction } from "grammy";
import prisma from "../../lib/prisma";
import { logger } from "../../lib/logger";
import type { BotContext } from "../lib/context";
import { t } from "../lib/i18n";

/**
 * Loads (or creates) the TelegramUser row matching the current chat and attaches
 * it to ctx.tgUser. Also enforces the global block list.
 *
 * Must run before any command handler that reads ctx.tgUser.
 */
export async function loadUser(ctx: BotContext, next: NextFunction): Promise<void> {
  const chat = ctx.chat;
  const from = ctx.from;

  // Bot can theoretically receive channel posts etc. without a `from`; skip those.
  if (!chat || !from || chat.type !== "private") {
    return;
  }

  const chatIdBig = BigInt(chat.id);
  const userIdBig = BigInt(from.id);

  try {
    // Snapshot the profile fields on every update so admin views stay fresh,
    // but only update what changed to keep updatedAt meaningful.
    const profile = {
      telegramUserId: userIdBig,
      username: from.username ?? null,
      firstName: from.first_name ?? null,
      lastName: from.last_name ?? null,
      languageCode: from.language_code ?? null,
      lastSeenAt: new Date(),
    };

    const tgUser = await prisma.telegramUser.upsert({
      where: { telegramChatId: chatIdBig },
      create: {
        telegramChatId: chatIdBig,
        ...profile,
      },
      update: profile,
    });

    if (tgUser.isBlocked) {
      await ctx.reply(t("en", "blocked"));
      return;
    }

    ctx.tgUser = tgUser;
    await next();
  } catch (err: any) {
    logger.error("bot_load_user_failed", {
      chatId: String(chatIdBig),
      error: err?.message,
    });
    await ctx.reply(t("en", "internalError")).catch(() => {});
  }
}
