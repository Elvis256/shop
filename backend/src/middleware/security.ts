import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { Express } from "express";

const isProduction = process.env.NODE_ENV === "production";

// Rate limiters — use MemoryStore by default; Redis store can be added when Redis is stable
// The MemoryStore works fine for single-process deployments.
// When scaling to multiple processes, switch to rate-limit-redis.

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 500 : 1000,
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 20 : 100,
  message: { error: "Too many login attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: "Too many checkout attempts, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const newsletterLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: "Too many subscribe attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const orderTrackingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many tracking requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const couponLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many coupon attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

export function setupSecurity(app: Express) {
  app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: isProduction ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", process.env.BASE_URL || "http://localhost:3000"],
          fontSrc: ["'self'", "https:", "data:"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
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
  app.use("/api/checkout", checkoutLimiter);
  app.use("/api/newsletter/subscribe", newsletterLimiter);
  app.use("/api/orders/track", orderTrackingLimiter);
  app.use("/api/coupons/apply", couponLimiter);
}
