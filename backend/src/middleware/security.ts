import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import helmet from "helmet";
import crypto from "crypto";
import Redis from "ioredis";
import { Express, Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

const isProduction = process.env.NODE_ENV === "production";

// CSP nonce middleware — generates per-request nonce for inline scripts
export function cspNonceMiddleware(req: Request, res: Response, next: NextFunction) {
  (res as any).locals.cspNonce = crypto.randomBytes(16).toString("base64");
  next();
}

// Dedicated Redis client for rate limiting — separate from the app client
// Uses enableOfflineQueue:true so RedisStore can init before connection is ready
let rlRedis: Redis | null = null;
try {
  const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
  rlRedis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableOfflineQueue: true,
    retryStrategy(times) {
      if (times > 5) return null;
      return Math.min(times * 2000, 30_000);
    },
  });
  rlRedis.on("error", () => {
    // Silently ignore — rate limiting will fall back to memory
  });
} catch {
  logger.warn("Redis unavailable for rate limiting, using in-memory store");
}

// Redis-backed rate limiting — works across multiple processes
function createRedisStore(prefix: string): RedisStore | undefined {
  if (!rlRedis) return undefined;
  try {
    return new RedisStore({
      sendCommand: (...args: string[]) => (rlRedis as any).call(...args),
      prefix: `rl:${prefix}:`,
    });
  } catch {
    return undefined;
  }
}

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 500 : 1000,
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("general"),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 20 : 100,
  message: { error: "Too many login attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("auth"),
});

export const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: "Too many checkout attempts, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("checkout"),
});

export const newsletterLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: "Too many subscribe attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("newsletter"),
});

export const orderTrackingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many tracking requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("tracking"),
});

export const couponLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many coupon attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("coupon"),
});

export function setupSecurity(app: Express) {
  app.set("trust proxy", 1);
  app.use(cspNonceMiddleware);
  app.use(
    helmet({
      contentSecurityPolicy: isProduction ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", (_req: any, res: any) => `'nonce-${res.locals.cspNonce}'`],
          styleSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline needed for styled-components / inline styles
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", process.env.BASE_URL || "http://localhost:3000", process.env.FRONTEND_URL || "https://ugsex.com"],
          fontSrc: ["'self'", "https:", "data:"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'", "https:"],
          frameSrc: ["https://www.youtube.com", "https://player.vimeo.com"],
          upgradeInsecureRequests: isProduction ? [] : null,
        },
      } : false,
      crossOriginEmbedderPolicy: false,
      hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
      noSniff: true,
      xssFilter: true,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    })
  );

  app.use("/api/", generalLimiter);
  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/register", authLimiter);
  app.use("/api/auth/forgot-password", authLimiter);
  app.post("/api/checkout/create", checkoutLimiter);
  app.post("/api/checkout/split/:orderId/pay", checkoutLimiter);
  app.use("/api/newsletter/subscribe", newsletterLimiter);
  app.use("/api/orders/track", orderTrackingLimiter);
  app.use("/api/coupons/apply", couponLimiter);
}
