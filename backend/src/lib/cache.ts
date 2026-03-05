import redis from "./redis";

const DEFAULT_TTL = 300; // 5 minutes
const SHORT_TTL = 60;   // 1 minute
const LONG_TTL = 1800;  // 30 minutes

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get(`cache:${key}`);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, data: any, ttl = DEFAULT_TTL): Promise<void> {
  try {
    await redis.set(`cache:${key}`, JSON.stringify(data), "EX", ttl);
  } catch {}
}

export async function cacheDel(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(`cache:${pattern}`);
    if (keys.length > 0) await redis.del(...keys);
  } catch {}
}

// Stale-while-revalidate: return cached data immediately, refresh in background
export async function cacheGetOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = DEFAULT_TTL
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;
  const data = await fetcher();
  await cacheSet(key, data, ttl);
  return data;
}

// Increment a counter (for view counts, trending scores)
export async function cacheIncr(key: string, ttl = 86400): Promise<number> {
  try {
    const val = await redis.incr(`cache:${key}`);
    if (val === 1) await redis.expire(`cache:${key}`, ttl);
    return val;
  } catch {
    return 0;
  }
}

// Track active viewers (set with auto-expiry)
export async function trackViewer(productId: string, sessionId: string): Promise<number> {
  const key = `viewers:${productId}`;
  try {
    await redis.sadd(key, sessionId);
    await redis.expire(key, 120); // viewers expire after 2 min
    return await redis.scard(key);
  } catch {
    return 0;
  }
}

export async function getViewerCount(productId: string): Promise<number> {
  try {
    return await redis.scard(`viewers:${productId}`);
  } catch {
    return 0;
  }
}

// Track trending scores (increment on view/purchase)
export async function trackTrending(productId: string, score = 1): Promise<void> {
  try {
    await redis.zincrby("trending:products", score, productId);
    await redis.expire("trending:products", 86400);
  } catch {}
}

export async function getTrendingIds(limit = 10): Promise<string[]> {
  try {
    return await redis.zrevrange("trending:products", 0, limit - 1);
  } catch {
    return [];
  }
}

// Search analytics
export async function trackSearch(query: string): Promise<void> {
  try {
    const normalized = query.toLowerCase().trim();
    await redis.zincrby("search:popular", 1, normalized);
    await redis.expire("search:popular", 604800); // 7 days
  } catch {}
}

export async function getPopularSearches(limit = 10): Promise<string[]> {
  try {
    return await redis.zrevrange("search:popular", 0, limit - 1);
  } catch {
    return [];
  }
}

export { DEFAULT_TTL, SHORT_TTL, LONG_TTL };
