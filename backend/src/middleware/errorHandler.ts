import { Request, Response, NextFunction } from "express";
import logger from "../lib/logger";

// Extend Express Request to include request ID
declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

/**
 * Standardized API Error Response
 */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    requestId?: string;
    timestamp: string;
  };
}

export class ApiError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Global error handler middleware
 * Catches all errors and returns standardized response
 */
export function errorHandler(
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const requestId = req.id || "unknown";
  const timestamp = new Date().toISOString();

  // Handle ApiError (application errors)
  if (err instanceof ApiError) {
    logger.warn(`api_error_${err.code}`, {
      requestId,
      message: err.message,
      statusCode: err.statusCode,
      details: err.details,
      path: req.path,
      method: req.method,
    });

    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId,
        timestamp,
      },
    } as ApiErrorResponse);
  }

  // Handle validation errors (Zod)
  if (err.name === "ZodError") {
    logger.warn("validation_error", {
      requestId,
      path: req.path,
      method: req.method,
      errors: (err as any).errors,
    });

    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: {
          errors: (err as any).errors?.map((e: any) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        requestId,
        timestamp,
      },
    } as ApiErrorResponse);
  }

  // Handle Prisma errors
  if ((err as any).code === "P2002") {
    logger.warn("database_unique_constraint", {
      requestId,
      path: req.path,
      message: err.message,
    });

    return res.status(409).json({
      error: {
        code: "DUPLICATE_ENTRY",
        message: "A record with this value already exists",
        requestId,
        timestamp,
      },
    } as ApiErrorResponse);
  }

  if ((err as any).code === "P2025") {
    logger.warn("database_record_not_found", {
      requestId,
      path: req.path,
    });

    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "The requested resource was not found",
        requestId,
        timestamp,
      },
    } as ApiErrorResponse);
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    logger.warn("jwt_error", {
      requestId,
      path: req.path,
      message: err.message,
    });

    return res.status(401).json({
      error: {
        code: "INVALID_TOKEN",
        message: "Invalid or expired authentication token",
        requestId,
        timestamp,
      },
    } as ApiErrorResponse);
  }

  // Generic server error
  logger.error("unhandled_error", {
    requestId,
    path: req.path,
    method: req.method,
    message: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message:
        process.env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : err.message,
      requestId,
      timestamp,
    },
  } as ApiErrorResponse);
}

/**
 * Async route wrapper to catch async errors
 * Usage: router.get("/path", asyncHandler(async (req, res) => { ... }))
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Common error constructors
 */
export const Errors = {
  BadRequest: (message: string, details?: Record<string, any>) =>
    new ApiError("BAD_REQUEST", 400, message, details),

  Unauthorized: (message: string = "Unauthorized") =>
    new ApiError("UNAUTHORIZED", 401, message),

  Forbidden: (message: string = "Forbidden") =>
    new ApiError("FORBIDDEN", 403, message),

  NotFound: (resource: string = "Resource") =>
    new ApiError("NOT_FOUND", 404, `${resource} not found`),

  Conflict: (message: string, details?: Record<string, any>) =>
    new ApiError("CONFLICT", 409, message, details),

  TooManyRequests: (message: string = "Too many requests, please try again later") =>
    new ApiError("RATE_LIMIT_EXCEEDED", 429, message),

  UnprocessableEntity: (message: string, details?: Record<string, any>) =>
    new ApiError("VALIDATION_ERROR", 422, message, details),

  InternalServerError: (message: string = "Internal server error") =>
    new ApiError("INTERNAL_SERVER_ERROR", 500, message),
};
