import type { StorageAdapter } from "grammy";
import redis from "../../lib/redis";
import { logger } from "../../lib/logger";
import type { BotSessionData } from "./context";

/**
 * Grammy storage adapter backed by Redis with in-memory fallback.
 *
 * If Redis is unavailable (or commands time out) we transparently fall back to
 * a Map so the bot keeps working — sessions just won't survive bot restarts.
 * Acceptable trade-off: a restart already resets any in-flight conversation.
 */

const PREFIX = "bot:tg-customer:session:";
const TTL_SECONDS = 60 * 60 * 24 * 7; // 1 week

const memoryFallback = new Map<string, { value: BotSessionData; expiresAt: number }>();

function memGet(key: string): BotSessionData | undefined {
  const entry = memoryFallback.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    memoryFallback.delete(key);
    return undefined;
  }
  return entry.value;
}

function memSet(key: string, value: BotSessionData) {
  memoryFallback.set(key, { value, expiresAt: Date.now() + TTL_SECONDS * 1000 });
}

export const redisSessionStorage: StorageAdapter<BotSessionData> = {
  async read(key) {
    const redisKey = PREFIX + key;
    try {
      const raw = await redis.get(redisKey);
      if (raw) return JSON.parse(raw) as BotSessionData;
    } catch (err: any) {
      logger.warn("bot_session_redis_read_failed", { error: err?.message });
    }
    return memGet(key);
  },

  async write(key, value) {
    const redisKey = PREFIX + key;
    const serialized = JSON.stringify(value);
    try {
      await redis.set(redisKey, serialized, "EX", TTL_SECONDS);
      return;
    } catch (err: any) {
      logger.warn("bot_session_redis_write_failed", { error: err?.message });
    }
    memSet(key, value);
  },

  async delete(key) {
    const redisKey = PREFIX + key;
    try {
      await redis.del(redisKey);
    } catch (err: any) {
      logger.warn("bot_session_redis_delete_failed", { error: err?.message });
    }
    memoryFallback.delete(key);
  },
};
