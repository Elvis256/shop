import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  enableOfflineQueue: false,
});

redis.on("error", (err) => {
  // Log but don't crash — app works without Redis (falls back to in-memory)
  console.error("[Redis] Connection error:", err.message);
});

export default redis;
