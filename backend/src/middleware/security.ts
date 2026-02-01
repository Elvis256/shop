import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { Express } from "express";

// Rate limiters
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 attempts per hour
  message: { error: "Too many login attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 checkout attempts per minute
  message: { error: "Too many checkout attempts, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
});

export function setupSecurity(app: Express) {
  // Helmet for security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disable for development
      crossOriginEmbedderPolicy: false,
    })
  );

  // Apply general rate limiter
  app.use("/api/", generalLimiter);

  // Apply stricter limits to auth routes
  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/register", authLimiter);
  app.use("/api/auth/forgot-password", authLimiter);

  // Checkout rate limiting
  app.use("/api/checkout", checkoutLimiter);
}
