import { z } from "zod";

/**
 * Enhanced Zod validation schemas with sensible limits
 * Prevents buffer overflow, DoS attacks via oversized inputs
 */

// Base schemas with length limits
export const SafeString = z
  .string()
  .max(1000, "String too long (max 1000 characters)");

export const SafeLongString = z
  .string()
  .max(10000, "String too long (max 10000 characters)");

export const SafeEmail = z
  .string()
  .email("Invalid email format")
  .max(255, "Email too long");

export const SafePhone = z
  .string()
  .regex(/^[\d\s\-\+\(\)]{7,20}$/, "Invalid phone format")
  .max(20, "Phone number too long");

export const SafePostalCode = z
  .string()
  .regex(/^[A-Z0-9\s\-]{3,10}$/i, "Invalid postal code format")
  .max(10, "Postal code too long");

export const SafeCouponCode = z
  .string()
  .regex(/^[A-Z0-9\-]{3,20}$/, "Invalid coupon code format")
  .max(20, "Coupon code too long");

export const SafeUrl = z
  .string()
  .url("Invalid URL format")
  .max(2048, "URL too long");

export const SafePrice = z
  .number()
  .positive("Price must be positive")
  .max(999999999, "Price too high")
  .finite("Price must be a valid number");

export const SafeQuantity = z
  .number()
  .int("Quantity must be an integer")
  .positive("Quantity must be positive")
  .max(999999, "Quantity too high");

/**
 * Sanitization functions
 */

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
    .trim();
}

/**
 * Sanitize coupon code (uppercase, alphanumeric + dash only)
 */
export function sanitizeCouponCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9\-]/g, "");
}

/**
 * Validate and normalize phone number
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except +
  return phone.replace(/[^\d\+]/g, "");
}

/**
 * Normalize email (lowercase, trim)
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Check if input is likely a SQL injection attempt
 */
export function isSuspiciousSqlPattern(input: string): boolean {
  const sqlKeywords = [
    "SELECT", "INSERT", "UPDATE", "DELETE", "DROP", "ALTER",
    "UNION", "OR", "AND", "EXEC", "EXECUTE", "SCRIPT"
  ];
  const upperInput = input.toUpperCase();
  return sqlKeywords.some(keyword => upperInput.includes(keyword));
}

/**
 * Enhanced product create schema with validation
 */
export const CreateProductSchema = z.object({
  name: SafeString,
  description: SafeLongString.optional(),
  price: SafePrice,
  quantity: SafeQuantity,
  sku: z.string().max(50).optional(),
  category: z.string().max(100).optional(),
});

/**
 * Enhanced checkout schema with validation
 */
export const EnhancedCheckoutSchema = z.object({
  cartId: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().max(50),
    quantity: SafeQuantity,
    price: SafePrice,
  })).optional(),
  currency: z.string().max(3),
  amount: SafePrice,
  shipping: SafePrice.default(0),
  paymentMethod: z.enum(["card", "mobile_money", "paypal", "cod"]),
  customer: z.object({
    name: SafeString,
    email: SafeEmail,
    phone: SafePhone.optional(),
  }),
  couponCode: SafeCouponCode.optional(),
  shippingAddress: z.object({
    street: SafeString,
    city: SafeString,
    state: SafeString,
    postalCode: SafePostalCode,
    country: z.string().max(3),
  }).optional(),
  installments: z.number().int().min(2).max(4).optional(),
});

/**
 * Admin product edit schema with validation
 */
export const AdminProductEditSchema = z.object({
  name: SafeString,
  description: SafeLongString.optional(),
  price: SafePrice,
  quantity: SafeQuantity,
  updatedAt: z.string().datetime(), // Optimistic locking
});

/**
 * Validation middleware factory
 * Usage: app.post("/path", validate(SomeSchema), handler)
 */
import { Request, Response, NextFunction } from "express";
import { Errors } from "./errorHandler";

export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors = error.errors.map(e => ({
          field: e.path.join("."),
          message: e.message,
          code: e.code,
        }));
        return next(Errors.UnprocessableEntity(
          "Input validation failed",
          { fields: fieldErrors }
        ));
      }
      next(error);
    }
  };
}

/**
 * Rate limit error response validator
 */
export function validateRateLimitResponse(retryAfter: number | null) {
  return {
    error: "RATE_LIMIT_EXCEEDED",
    message: "Too many requests, please try again later",
    retryAfter: retryAfter || 60,
    timestamp: new Date().toISOString(),
  };
}
