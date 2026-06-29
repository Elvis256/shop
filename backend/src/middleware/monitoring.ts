import { Request, Response, NextFunction, Express } from "express";
import prisma from "../lib/prisma";
import redis from "../lib/redis";
import logger from "../lib/logger";
import os from "os";

/**
 * Health Check Endpoints
 * Monitors: Database, Redis, API health
 */

export interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  environment: string;
  checks: {
    database: HealthCheckResult;
    redis: HealthCheckResult;
    memory: HealthCheckResult;
    cpu: HealthCheckResult;
  };
}

export interface HealthCheckResult {
  status: "ok" | "warning" | "error";
  message: string;
  timestamp: string;
  details?: Record<string, any>;
}

async function checkDatabase(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - startTime;
    return {
      status: latency > 1000 ? "warning" : "ok",
      message: latency > 1000 ? "Database response slow" : "Database connected",
      timestamp: new Date().toISOString(),
      details: { latency_ms: latency },
    };
  } catch (error) {
    logger.error("health_check_db_failed", { error: String(error) });
    return {
      status: "error",
      message: `Database connection failed: ${String(error)}`,
      timestamp: new Date().toISOString(),
    };
  }
}

async function checkRedis(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  try {
    const pong = await redis.ping();
    const latency = Date.now() - startTime;
    return {
      status: latency > 500 ? "warning" : "ok",
      message: pong === "PONG" ? "Redis connected" : "Redis response invalid",
      timestamp: new Date().toISOString(),
      details: { latency_ms: latency, response: pong },
    };
  } catch (error) {
    logger.warn("health_check_redis_failed", { error: String(error) });
    return {
      status: "warning",
      message: `Redis connection failed (non-critical): ${String(error)}`,
      timestamp: new Date().toISOString(),
    };
  }
}

function checkMemory(): HealthCheckResult {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const usagePercent = (usedMemory / totalMemory) * 100;

  const status =
    usagePercent > 90 ? "error" : usagePercent > 80 ? "warning" : "ok";

  return {
    status,
    message: `Memory usage: ${usagePercent.toFixed(1)}%`,
    timestamp: new Date().toISOString(),
    details: {
      total_mb: Math.round(totalMemory / 1024 / 1024),
      used_mb: Math.round(usedMemory / 1024 / 1024),
      free_mb: Math.round(freeMemory / 1024 / 1024),
      usage_percent: usagePercent.toFixed(1),
    },
  };
}

function checkCPU(): HealthCheckResult {
  const loadAverage = os.loadavg();
  const cpuCount = os.cpus().length;
  const loadPercent = (loadAverage[0] / cpuCount) * 100;

  const status = loadPercent > 80 ? "warning" : "ok";

  return {
    status,
    message: `CPU load: ${loadPercent.toFixed(1)}%`,
    timestamp: new Date().toISOString(),
    details: {
      load_1min: loadAverage[0].toFixed(2),
      load_5min: loadAverage[1].toFixed(2),
      load_15min: loadAverage[2].toFixed(2),
      cpu_cores: cpuCount,
      load_percent: loadPercent.toFixed(1),
    },
  };
}

export async function getHealthStatus(): Promise<HealthResponse> {
  const startTime = Date.now();
  const [db, redisCheck, memory, cpu] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    Promise.resolve(checkMemory()),
    Promise.resolve(checkCPU()),
  ]);

  const uptime = process.uptime();
  const allChecks = [db, redisCheck, memory, cpu];
  const hasError = allChecks.some((check) => check.status === "error");
  const hasWarning = allChecks.some((check) => check.status === "warning");
  const overallStatus = hasError ? "unhealthy" : hasWarning ? "degraded" : "healthy";

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime,
    environment: process.env.NODE_ENV || "development",
    checks: { database: db, redis: redisCheck, memory, cpu },
  };
}

/**
 * Health check routes
 */
export async function setupHealthChecks(app: Express) {
  // Main health check endpoint
  const mainHealth = async (req: Request, res: Response) => {
    const health = await getHealthStatus();
    const statusCode =
      health.status === "healthy"
        ? 200
        : health.status === "degraded"
          ? 206
          : 503;
    res.status(statusCode).json(health);
  };
  app.get("/health", mainHealth);
  app.get("/api/health", mainHealth); // exposed via /api/ for nginx-proxied external monitoring

  // Quick health check (no details)
  const quickHealth = async (req: Request, res: Response) => {
    try {
      await Promise.race([
        prisma.$queryRaw`SELECT 1`,
        redis.ping(),
      ]);
      res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: "error", timestamp: new Date().toISOString() });
    }
  };
  app.get("/health/quick", quickHealth);
  app.get("/api/health/quick", quickHealth);

  // Database specific check
  app.get("/health/db", async (req: Request, res: Response) => {
    const check = await checkDatabase();
    const statusCode = check.status === "error" ? 503 : 200;
    res.status(statusCode).json(check);
  });

  // Redis specific check
  app.get("/health/redis", async (req: Request, res: Response) => {
    const check = await checkRedis();
    const statusCode = check.status === "error" ? 503 : 200;
    res.status(statusCode).json(check);
  });

  // Resource usage check
  app.get("/health/resources", (req: Request, res: Response) => {
    const memory = checkMemory();
    const cpu = checkCPU();

    const hasIssue = memory.status !== "ok" || cpu.status !== "ok";
    const statusCode = hasIssue ? 206 : 200;

    res.status(statusCode).json({ memory, cpu, timestamp: new Date().toISOString() });
  });

  logger.info("health_checks_registered", { endpoints: ["/health", "/api/health", "/health/quick", "/health/db", "/health/redis", "/health/resources"] });
}
