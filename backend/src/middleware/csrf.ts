import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";
const TOKEN_LENGTH = 32;

// Generate a cryptographically secure CSRF token
export function generateCsrfToken(): string {
  return crypto.randomBytes(TOKEN_LENGTH).toString("hex");
}

// Middleware to set CSRF token cookie
export function setCsrfToken(req: Request, res: Response, next: NextFunction) {
  // Skip for the CSRF token endpoint - it handles its own token
  if (req.path === "/api/csrf-token") {
    return next();
  }
  
  // Only set if not already present
  if (!req.cookies[CSRF_COOKIE_NAME]) {
    const token = generateCsrfToken();
    const isProduction = process.env.NODE_ENV === "production";
    
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false, // Must be readable by JS
      secure: isProduction,
      sameSite: isProduction ? "strict" : "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: "/",
    });
  }
  next();
}

// Middleware to validate CSRF token on state-changing requests
export function validateCsrf(req: Request, res: Response, next: NextFunction) {
  // Skip for safe methods
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Skip for webhooks (they use their own verification)
  if (req.path.startsWith("/api/webhooks")) {
    return next();
  }

  // Skip for analytics tracking (not sensitive, no auth required)
  if (req.path === "/api/analytics/track") {
    return next();
  }

  const cookieToken = req.cookies[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME] as string;

  if (!cookieToken || !headerToken) {
    return res.status(403).json({ error: "CSRF token missing" });
  }

  // Timing-safe comparison
  if (cookieToken.length !== headerToken.length) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  const isValid = crypto.timingSafeEqual(
    Buffer.from(cookieToken),
    Buffer.from(headerToken)
  );

  if (!isValid) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  next();
}

// Endpoint to get a fresh CSRF token
export function csrfTokenHandler(req: Request, res: Response) {
  // If client already has a token cookie, return that
  const existingToken = req.cookies[CSRF_COOKIE_NAME];
  if (existingToken) {
    return res.json({ csrfToken: existingToken });
  }
  
  // Generate new token
  const token = generateCsrfToken();
  const isProduction = process.env.NODE_ENV === "production";
  
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    maxAge: 24 * 60 * 60 * 1000,
    path: "/",
  });
  
  return res.json({ csrfToken: token });
}
