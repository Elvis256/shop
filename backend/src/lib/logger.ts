import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_LEVEL = LOG_LEVELS[(process.env.LOG_LEVEL as LogLevel) || "info"] ?? 1;

function serializeValue(v: unknown): unknown {
  if (v instanceof Error) return { message: v.message, stack: v.stack };
  return v;
}

function write(level: LogLevel, message: string, data?: Record<string, any>) {
  if (LOG_LEVELS[level] < MIN_LEVEL) return;
  let safe: Record<string, any> | undefined;
  if (data) {
    safe = {};
    for (const k of Object.keys(data)) safe[k] = serializeValue(data[k]);
  }
  const entry = {
    level,
    timestamp: new Date().toISOString(),
    message,
    ...safe,
  };
  const out = level === "error" || level === "warn" ? process.stderr : process.stdout;
  out.write(JSON.stringify(entry) + "\n");
}

export const logger = {
  debug: (msg: string, data?: Record<string, any>) => write("debug", msg, data),
  info: (msg: string, data?: Record<string, any>) => write("info", msg, data),
  warn: (msg: string, data?: Record<string, any>) => write("warn", msg, data),
  error: (msg: string, data?: Record<string, any>) => write("error", msg, data),
};

// Middleware: attach request ID and log request/response
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers["x-request-id"] as string) || crypto.randomUUID();
  (req as any).requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  next();
}

export function requestLogMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on("finish", () => {
    // Skip health check noise
    if (req.path === "/health") return;
    logger.info("request", {
      requestId: (req as any).requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: Date.now() - start,
      ip: req.ip,
    });
  });
  next();
}

export default logger;
