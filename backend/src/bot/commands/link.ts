import { Composer, InlineKeyboard, Keyboard } from "grammy";
import crypto from "crypto";
import prisma from "../../lib/prisma";
import redis from "../../lib/redis";
import { logger } from "../../lib/logger";
import { sendSMS } from "../../services/sms";
import type { BotContext } from "../lib/context";
import { t } from "../lib/i18n";
import { syncSessionCartToDb } from "../lib/cartService";

/**
 * Account linking via phone OTP.
 *
 * Flow:
 *   1. /link → ask customer to share phone (Telegram contact button or typed).
 *   2. Bot normalises phone → looks up User.phone match.
 *      - No match: tell them to register on ugsex.com.
 *   3. Match → generate 6-digit code, store in Redis (10 min TTL), SMS it.
 *   4. Customer types code in chat → bot verifies → updates TelegramUser.userId.
 *
 * Security notes:
 *   - Code is a CSPRNG 6-digit number stored as a constant-time-compared string.
 *   - Max 5 attempts per code (Redis counter), then code is invalidated.
 *   - At most one OTP request per chat per 60s (rate-limit key in Redis).
 *   - At most one TelegramUser per User.id (DB unique index on userId enforces it).
 *
 * Session flow keys:
 *   - "link:awaiting-phone"     — waiting for /share-contact or typed phone.
 *   - "link:awaiting-code"      — OTP sent, waiting for the 6-digit code.
 */
export const linkCommands = new Composer<BotContext>();

const PHONE_REGEX = /^\+?[1-9]\d{7,14}$/;
const OTP_TTL_SECONDS = 10 * 60;
const OTP_MAX_ATTEMPTS = 5;
const OTP_REQUEST_COOLDOWN_SECONDS = 60;
const OTP_REQUESTS_PER_HOUR = 5;

function otpKey(chatId: string) {
  return `bot:tg-customer:otp:${chatId}`;
}
function otpAttemptsKey(chatId: string) {
  return `bot:tg-customer:otp-attempts:${chatId}`;
}
function otpCooldownKey(chatId: string) {
  return `bot:tg-customer:otp-cooldown:${chatId}`;
}
function otpHourlyKey(chatId: string) {
  return `bot:tg-customer:otp-hourly:${chatId}`;
}

function normalisePhone(raw: string): string | null {
  let phone = raw.trim().replace(/[\s\-()]/g, "");
  // Convert leading 0 → +256 (Uganda default — matches services/sms.ts)
  if (phone.startsWith("00")) phone = "+" + phone.slice(2);
  if (phone.startsWith("0")) phone = "+256" + phone.slice(1);
  if (!phone.startsWith("+")) phone = "+" + phone;
  return PHONE_REGEX.test(phone) ? phone : null;
}

function generateOtp(): string {
  // 6-digit code; zero-padded.
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, "0");
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

linkCommands.command("link", async (ctx) => {
  if (ctx.tgUser.userId) {
    const user = await prisma.user.findUnique({
      where: { id: ctx.tgUser.userId },
      select: { name: true, email: true },
    });
    const displayName = user?.name || user?.email || "your account";
    await ctx.reply(t("en", "linkAlreadyLinked", { name: displayName }), {
      parse_mode: "Markdown",
    });
    return;
  }

  ctx.session.flow = "link:awaiting-phone";
  ctx.session.flowData = {};

  const contactKeyboard = new Keyboard()
    .requestContact(t("en", "linkSharePhoneButton"))
    .text(t("en", "linkCancelButton"))
    .oneTime()
    .resized();

  await ctx.reply(t("en", "linkPromptPhone"), {
    parse_mode: "Markdown",
    reply_markup: contactKeyboard,
  });
});

// Handle a shared contact (phone shared via Telegram's contact button).
linkCommands.on("message:contact", async (ctx) => {
  if (ctx.session.flow !== "link:awaiting-phone") return;
  const contact = ctx.message.contact;

  // Reject contacts that aren't the user themselves (Telegram lets you share
  // any contact — we only want the chat owner's number for linking).
  if (contact.user_id && BigInt(contact.user_id) !== ctx.tgUser.telegramUserId) {
    await ctx.reply(
      "That's someone else's contact — please use the *Share my number* button to share *your* number.",
      { parse_mode: "Markdown" }
    );
    return;
  }

  await handlePhoneSubmission(ctx, contact.phone_number);
});

// Handle "Cancel" tap (reply-keyboard) and /cancel during link.
linkCommands.hears(/^cancel$/i, async (ctx) => {
  if (ctx.session.flow?.startsWith("link:")) {
    ctx.session.flow = undefined;
    ctx.session.flowData = undefined;
    await ctx.reply(t("en", "linkCancelled"), { reply_markup: { remove_keyboard: true } });
  }
});

// Handle typed messages during link flow (phone or code).
linkCommands.on("message:text", async (ctx, next) => {
  const text = ctx.message.text.trim();

  // Skip slash commands — they have their own handlers.
  if (text.startsWith("/")) return next();

  if (ctx.session.flow === "link:awaiting-phone") {
    await handlePhoneSubmission(ctx, text);
    return;
  }

  if (ctx.session.flow === "link:awaiting-code") {
    await handleCodeSubmission(ctx, text);
    return;
  }

  await next();
});

async function handlePhoneSubmission(ctx: BotContext, rawPhone: string): Promise<void> {
  const phone = normalisePhone(rawPhone);
  if (!phone) {
    await ctx.reply(t("en", "linkPhoneInvalid"), { parse_mode: "Markdown" });
    return;
  }

  const chatId = String(ctx.tgUser.telegramChatId);

  // Rate-limit: 1 request per minute, 5 per hour, per chat.
  try {
    const cooldown = await redis.get(otpCooldownKey(chatId));
    if (cooldown) {
      await ctx.reply(t("en", "linkCodeRateLimited"));
      return;
    }
    const hourly = await redis.incr(otpHourlyKey(chatId));
    if (hourly === 1) await redis.expire(otpHourlyKey(chatId), 60 * 60);
    if (hourly > OTP_REQUESTS_PER_HOUR) {
      await ctx.reply(t("en", "linkCodeRateLimited"));
      return;
    }
  } catch (err: any) {
    // Redis down — don't block linking, just log. SMS cost is the only risk and
    // the OTP store itself is also Redis (so OTP won't actually be sendable).
    logger.warn("bot_link_ratelimit_unavailable", { error: err?.message });
  }

  const user = await prisma.user.findFirst({
    where: { phone, isBlocked: false },
    select: { id: true, name: true, email: true, phone: true },
  });

  if (!user) {
    await ctx.reply(t("en", "linkNoMatch"), {
      reply_markup: { remove_keyboard: true },
    });
    ctx.session.flow = undefined;
    ctx.session.flowData = undefined;
    return;
  }

  // Refuse if this user is already linked to a *different* chat.
  const existingLink = await prisma.telegramUser.findUnique({
    where: { userId: user.id },
    select: { telegramChatId: true },
  });
  if (existingLink && existingLink.telegramChatId !== ctx.tgUser.telegramChatId) {
    await ctx.reply(t("en", "linkConflict"), {
      reply_markup: { remove_keyboard: true },
    });
    ctx.session.flow = undefined;
    ctx.session.flowData = undefined;
    return;
  }

  // Generate OTP, store in Redis, SMS it.
  const otp = generateOtp();
  try {
    await redis.set(otpKey(chatId), `${user.id}:${otp}`, "EX", OTP_TTL_SECONDS);
    await redis.del(otpAttemptsKey(chatId));
    await redis.set(otpCooldownKey(chatId), "1", "EX", OTP_REQUEST_COOLDOWN_SECONDS);
  } catch (err: any) {
    logger.error("bot_link_otp_store_failed", { chatId, error: err?.message });
    await ctx.reply(t("en", "internalError"));
    return;
  }

  const smsSent = await sendSMS(
    phone,
    `Your Ug Connect verification code is ${otp}. Expires in 10 minutes. Don't share it.`
  );

  if (!smsSent) {
    logger.warn("bot_link_sms_failed", { chatId, userId: user.id });
    // We still let the customer try the code if SMS is unconfigured — log it
    // server-side. In production with SMS configured, sendSMS returns true on
    // success and the code is only on the user's phone.
    logger.info("bot_link_otp_generated_no_sms", { chatId, userId: user.id, otp });
  }

  ctx.session.flow = "link:awaiting-code";
  ctx.session.flowData = { userId: user.id, phone };

  await ctx.reply(t("en", "linkCodeSent"), {
    reply_markup: { remove_keyboard: true },
  });
}

async function handleCodeSubmission(ctx: BotContext, rawCode: string): Promise<void> {
  const code = rawCode.replace(/\D/g, "").trim();
  if (code.length !== 6) {
    await ctx.reply(t("en", "linkCodeInvalid"));
    return;
  }

  const chatId = String(ctx.tgUser.telegramChatId);
  let stored: string | null = null;
  let attempts = 0;
  try {
    stored = await redis.get(otpKey(chatId));
    attempts = await redis.incr(otpAttemptsKey(chatId));
    if (attempts === 1) await redis.expire(otpAttemptsKey(chatId), OTP_TTL_SECONDS);
  } catch (err: any) {
    logger.error("bot_link_otp_lookup_failed", { chatId, error: err?.message });
    await ctx.reply(t("en", "internalError"));
    return;
  }

  if (!stored) {
    ctx.session.flow = undefined;
    ctx.session.flowData = undefined;
    await ctx.reply(t("en", "linkCodeExpired"));
    return;
  }

  if (attempts > OTP_MAX_ATTEMPTS) {
    await redis.del(otpKey(chatId)).catch(() => {});
    ctx.session.flow = undefined;
    ctx.session.flowData = undefined;
    await ctx.reply(t("en", "linkCodeRateLimited"));
    return;
  }

  const [userId, expectedCode] = stored.split(":");
  const flowUserId = (ctx.session.flowData as any)?.userId as string | undefined;
  const flowPhone = (ctx.session.flowData as any)?.phone as string | undefined;
  if (!flowUserId || flowUserId !== userId) {
    // Session data lost (e.g. bot restart) — start over.
    ctx.session.flow = undefined;
    ctx.session.flowData = undefined;
    await redis.del(otpKey(chatId)).catch(() => {});
    await ctx.reply(t("en", "linkCodeExpired"));
    return;
  }

  if (!timingSafeEqual(code, expectedCode)) {
    await ctx.reply(t("en", "linkCodeInvalid"));
    return;
  }

  // Code OK → link the account.
  try {
    await prisma.telegramUser.update({
      where: { id: ctx.tgUser.id },
      data: {
        userId,
        linkedAt: new Date(),
        linkedPhone: flowPhone,
      },
    });
    // Sync session cart to database cart
    await syncSessionCartToDb(ctx, userId).catch((err) => {
      logger.error("bot_cart_sync_failed", { userId, error: err?.message });
    });
  } catch (err: any) {
    // Could be P2002 race — another chat linked while we were verifying.
    if (err?.code === "P2002") {
      await ctx.reply(t("en", "linkConflict"));
    } else {
      logger.error("bot_link_update_failed", {
        chatId,
        userId,
        error: err?.message,
      });
      await ctx.reply(t("en", "internalError"));
    }
    return;
  }

  await Promise.all([
    redis.del(otpKey(chatId)).catch(() => {}),
    redis.del(otpAttemptsKey(chatId)).catch(() => {}),
  ]);
  ctx.session.flow = undefined;
  ctx.session.flowData = undefined;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  const displayName = user?.name || user?.email?.split("@")[0] || "there";

  await ctx.reply(t("en", "linkSuccess", { name: displayName }), {
    parse_mode: "Markdown",
  });
}

linkCommands.command("unlink", async (ctx) => {
  if (!ctx.tgUser.userId) {
    await ctx.reply(t("en", "unlinkNotLinked"));
    return;
  }
  const keyboard = new InlineKeyboard()
    .text(t("en", "unlinkConfirmButton"), "unlink:confirm")
    .text(t("en", "cancelButton"), "unlink:cancel");
  await ctx.reply(t("en", "unlinkConfirm"), { reply_markup: keyboard });
});

linkCommands.callbackQuery("unlink:cancel", async (ctx) => {
  await ctx.answerCallbackQuery().catch(() => {});
  await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {});
  await ctx.reply("OK — still linked.");
});

linkCommands.callbackQuery("unlink:confirm", async (ctx) => {
  try {
    await prisma.telegramUser.update({
      where: { id: ctx.tgUser.id },
      data: { userId: null, linkedAt: null, linkedPhone: null },
    });
  } catch (err: any) {
    logger.error("bot_unlink_failed", {
      chatId: String(ctx.tgUser.telegramChatId),
      error: err?.message,
    });
    await ctx.answerCallbackQuery({ text: "Error — try again." }).catch(() => {});
    return;
  }
  await ctx.answerCallbackQuery({ text: "Unlinked" }).catch(() => {});
  await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {});
  await ctx.reply(t("en", "unlinkDone"));
});
