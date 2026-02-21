import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { Express } from "express";

const isProduction = process.env.NODE_ENV === "production";

// Rate limiters - more permissive in development
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 100 : 1000, // 1000 requests in dev, 100 in prod
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isProduction ? 10 : 100, // 100 attempts in dev, 10 in prod
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
  
  // Helmet for security headers with proper CSP
  app.use(
    helmet({
      contentSecurityPolicy: isProduction ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"], // Adjust based on your needs
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

  // Apply general rate limiter
  app.use("/api/", generalLimiter);

  // Apply stricter limits to auth routes
  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/register", authLimiter);
  app.use("/api/auth/forgot-password", authLimiter);

  // Checkout rate limiting
  app.use("/api/checkout", checkoutLimiter);
}
