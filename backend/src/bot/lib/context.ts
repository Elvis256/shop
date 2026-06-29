import type { Context, SessionFlavor } from "grammy";
import type { TelegramUser } from "@prisma/client";
import type { Locale } from "./i18n";

/**
 * Per-chat session data persisted across updates (Redis-backed when available,
 * in-memory fallback otherwise — see middleware/session.ts).
 *
 * Keep this small: anything large or query-able lives in Postgres on TelegramUser.
 */
export interface BotSessionData {
  /** Set while a multi-step flow owns the conversation (e.g. "link:awaiting-phone"). */
  flow?: string;
  /** Per-flow scratch data. Always JSON-serialisable. */
  flowData?: Record<string, unknown>;
  /** Cached language preference so we don't re-query Postgres on every message. */
  locale?: Locale;
  /** Guest shopping cart, key is productId and value is quantity. */
  cart?: Record<string, number>;
}

/**
 * Custom Grammy context with session data + the resolved TelegramUser row.
 * `tgUser` is loaded by middleware/loadUser.ts — always present after that runs.
 */
export type BotContext = Context &
  SessionFlavor<BotSessionData> & {
    tgUser: TelegramUser;
  };
