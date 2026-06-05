import Redis from "ioredis";
import { logger } from "./logger";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

let lastErrorLog = 0;
const ERROR_LOG_INTERVAL = 60_000; // Only log Redis errors once per minute

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 1,
  lazyConnect: true,
  enableOfflineQueue: false,
  retryStrategy(times) {
    if (times > 5) return null; // Stop retrying after 5 attempts
    return Math.min(times * 2000, 30_000); // Exponential backoff, max 30s
  },
  reconnectOnError() {
    return false; // Don't auto-reconnect on command errors
  },
});

redis.on("error", (err) => {
  const now = Date.now();
  if (now - lastErrorLog > ERROR_LOG_INTERVAL) {
    logger.warn("redis_connection_unavailable", { error: err.message });
    lastErrorLog = now;
  }
});

// Eagerly connect since lazyConnect is true
redis.connect().catch((err) => {
  logger.warn("redis_initial_connection_failed", { error: err.message });
});

export default redis;
