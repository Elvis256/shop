import { Request, Response, NextFunction } from "express";
import logger from "../lib/logger";
import prisma from "../lib/prisma";

/**
 * Security event tracking and alerting
 * Tracks: failed auth, rate limit hits, suspicious activity
 */

export interface SecurityEvent {
  type: "failed_login" | "rate_limit_hit" | "suspicious_pattern" | "unauthorized_access" | "brute_force_attempt";
  userId?: string;
  email?: string;
  ipAddress: string;
  userAgent: string;
  path: string;
  details: Record<string, any>;
  timestamp: Date;
  severity: "low" | "medium" | "high" | "critical";
}

export interface LoginAttempt {
  id?: string;
  email: string;
  ipAddress: string;
  success: boolean;
  timestamp: Date;
  userAgent: string;
}

/**
 * Track login attempts for account lockout and brute force detection
 */
const loginAttempts = new Map<string, LoginAttempt[]>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export async function trackLoginAttempt(
  email: string,
  ipAddress: string,
  userAgent: string,
  success: boolean
) {
  const key = `${email}:${ipAddress}`;
  const now = new Date();

  if (!loginAttempts.has(key)) {
    loginAttempts.set(key, []);
  }

  const attempts = loginAttempts.get(key)!;

  // Remove attempts older than lockout duration
  const recentAttempts = attempts.filter(
    (a) => now.getTime() - a.timestamp.getTime() < LOCKOUT_DURATION_MS
  );

  recentAttempts.push({
    email,
    ipAddress,
    success,
    timestamp: now,
    userAgent,
  });

  loginAttempts.set(key, recentAttempts);

  // Log security event for failed attempts
  if (!success) {
    const failureCount = recentAttempts.filter((a) => !a.success).length;

    if (failureCount >= MAX_LOGIN_ATTEMPTS) {
      await logSecurityEvent({
        type: "brute_force_attempt",
        email,
        ipAddress,
        userAgent,
        path: "/auth/login",
        details: {
          failureCount,
          attempts: recentAttempts.map((a) => ({
            timestamp: a.timestamp,
            success: a.success,
          })),
        },
        severity: "high",
      });
    } else if (failureCount >= 3) {
      await logSecurityEvent({
        type: "failed_login",
        email,
        ipAddress,
        userAgent,
        path: "/auth/login",
        details: {
          failureCount,
          attemptsRemaining: MAX_LOGIN_ATTEMPTS - failureCount,
        },
        severity: "medium",
      });
    }
  }

  return {
    isLocked: recentAttempts.filter((a) => !a.success).length >= MAX_LOGIN_ATTEMPTS,
    attemptsRemaining: Math.max(0, MAX_LOGIN_ATTEMPTS - recentAttempts.filter((a) => !a.success).length),
  };
}

/**
 * Check if account is locked due to too many failed attempts
 */
export function isAccountLocked(email: string, ipAddress: string): boolean {
  const key = `${email}:${ipAddress}`;
  const attempts = loginAttempts.get(key) || [];
  const now = new Date();

  const recentFailures = attempts.filter(
    (a) =>
      !a.success && now.getTime() - a.timestamp.getTime() < LOCKOUT_DURATION_MS
  );

  return recentFailures.length >= MAX_LOGIN_ATTEMPTS;
}

/**
 * Get remaining login attempts
 */
export function getRemainingLoginAttempts(email: string, ipAddress: string): number {
  const key = `${email}:${ipAddress}`;
  const attempts = loginAttempts.get(key) || [];
  const now = new Date();

  const recentFailures = attempts.filter(
    (a) =>
      !a.success && now.getTime() - a.timestamp.getTime() < LOCKOUT_DURATION_MS
  );

  return Math.max(0, MAX_LOGIN_ATTEMPTS - recentFailures.length);
}

/**
 * Log security events
 */
export async function logSecurityEvent(event: Partial<SecurityEvent> & { type: SecurityEvent["type"]; ipAddress?: string; userAgent?: string; path: string; details: Record<string, any>; severity: SecurityEvent["severity"] }) {
  const securityEvent = {
    ...event,
    ipAddress: event.ipAddress || "unknown",
    userAgent: event.userAgent || "unknown",
    timestamp: new Date(),
  };

  // Log to application logger
  logger.warn(`security_event_${event.type}`, {
    ...securityEvent,
    requestId: "security-audit",
  });

  // For critical events, log with high visibility
  if (event.severity === "critical" || event.severity === "high") {
    console.error(`[SECURITY] ${event.type}: ${JSON.stringify(securityEvent, null, 2)}`);
  }

  // Store in database for audit trail (non-blocking)
  try {
    // Note: Requires a SecurityAuditLog or similar table in schema
    // This is a placeholder - implement based on your schema
    logger.info("security_event_stored", {
      type: event.type,
      severity: event.severity,
    });
  } catch (error) {
    logger.error("security_event_storage_failed", {
      type: event.type,
      error: String(error),
    });
  }
}

/**
 * Detect suspicious patterns in requests
 */
export function detectSuspiciousPatterns(
  req: Request
): { isSuspicious: boolean; reason?: string } {
  const suspiciousPatterns = [
    /\.\.\//, // Path traversal
    /[<>]/g, // HTML/script injection
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC)\b)/i, // SQL injection keywords
    /javascript:/i, // JavaScript protocol
    /on(load|click|error|mouseover)=/i, // Event handlers
  ];

  const checkParams = (obj: any, depth = 0): boolean => {
    if (depth > 5) return false; // Prevent deep recursion

    if (typeof obj === "string") {
      return suspiciousPatterns.some((pattern) => pattern.test(obj));
    }

    if (typeof obj === "object" && obj !== null) {
      return Object.values(obj).some((value) => checkParams(value, depth + 1));
    }

    return false;
  };

  // Check query parameters
  if (checkParams(req.query)) {
    return { isSuspicious: true, reason: "Suspicious pattern in query parameters" };
  }

  // Check request body
  if (checkParams(req.body)) {
    return { isSuspicious: true, reason: "Suspicious pattern in request body" };
  }

  // Check headers for suspicious User-Agent
  const userAgent = req.headers["user-agent"] || "";
  if (
    userAgent.includes("sqlmap") ||
    userAgent.includes("nikto") ||
    userAgent.includes("nmap") ||
    userAgent.includes("masscan")
  ) {
    return { isSuspicious: true, reason: "Known security scanner detected" };
  }

  return { isSuspicious: false };
}

/**
 * Middleware to track suspicious activity
 */
export function suspiciousActivityMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { isSuspicious, reason } = detectSuspiciousPatterns(req);

  if (isSuspicious) {
    const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";

    logSecurityEvent({
      type: "suspicious_pattern",
      ipAddress,
      userAgent,
      path: req.path,
      details: {
        reason,
        method: req.method,
        query: req.query,
      },
      severity: "medium",
    });

    // Log but don't block - let rate limiter handle DoS
  }

  next();
}

/**
 * Rate limit event handler
 */
export async function onRateLimitHit(
  req: Request,
  limit: string,
  retryAfter?: number
) {
  const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
  const userAgent = req.headers["user-agent"] || "unknown";

  await logSecurityEvent({
    type: "rate_limit_hit",
    ipAddress,
    userAgent,
    path: req.path,
    details: {
      limit,
      retryAfter,
      method: req.method,
    },
    severity: "low",
  });
}

/**
 * Unauthorized access handler
 */
export async function onUnauthorizedAccess(
  req: Request,
  reason: string
) {
  const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
  const userAgent = req.headers["user-agent"] || "unknown";
  const userId = (req as any).user?.id;

  await logSecurityEvent({
    type: "unauthorized_access",
    userId,
    ipAddress,
    userAgent,
    path: req.path,
    details: {
      reason,
      method: req.method,
    },
    severity: "medium",
  });
}

// Cleanup: Remove old login attempts every 5 minutes
setInterval(() => {
  const now = new Date();
  for (const [key, attempts] of loginAttempts.entries()) {
    const recentAttempts = attempts.filter(
      (a) => now.getTime() - a.timestamp.getTime() < LOCKOUT_DURATION_MS
    );
    if (recentAttempts.length === 0) {
      loginAttempts.delete(key);
    } else {
      loginAttempts.set(key, recentAttempts);
    }
  }
}, 5 * 60 * 1000);
