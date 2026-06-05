import dotenv from "dotenv";
import { z } from "zod";

// Load .env before anything else
dotenv.config();

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, "Prisma requires a database connection string"),

  // Auth
  JWT_SECRET: z.string().min(16, "Must be at least 16 characters"),

  // Server (optional — sensible defaults exist)
  PORT: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
  FRONTEND_URL: z.string().optional(),
  BASE_URL: z.string().optional(),
  BACKEND_URL: z.string().optional(),
  SITE_URL: z.string().optional(),

  // Redis (defaults to localhost in redis.ts)
  REDIS_URL: z.string().optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // SMTP
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  FROM_EMAIL: z.string().optional(),

  // Push notifications
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),

  // Payment providers
  FLW_SECRET_KEY: z.string().optional(),
  FLW_WEBHOOK_HASH: z.string().optional(),
  MTN_WEBHOOK_SECRET: z.string().optional(),
  AIRTEL_CALLBACK_TOKEN: z.string().optional(),
  PAYPAL_MODE: z.enum(["sandbox", "live"]).optional(),
  PAYPAL_API_USERNAME: z.string().optional(),
  PAYPAL_API_PASSWORD: z.string().optional(),
  PAYPAL_API_SIGNATURE: z.string().optional(),

  // External services
  ANTHROPIC_API_KEY: z.string().optional(),
  SAFEBODA_API_KEY: z.string().optional(),
  SENDY_API_KEY: z.string().optional(),
  SENDY_VENDOR_ID: z.string().optional(),

  // Dropshipping
  CJ_ACCESS_TOKEN: z.string().optional(),
  CJ_API_KEY: z.string().optional(),
  CJ_EMAIL: z.string().optional(),
  AE_APP_KEY: z.string().optional(),
  AE_APP_SECRET: z.string().optional(),
  AE_ACCESS_TOKEN: z.string().optional(),

  // WhatsApp
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  SUPPORT_PHONE: z.string().optional(),

  // Uploads
  UPLOAD_DIR: z.string().optional(),
  MAX_FILE_SIZE: z.string().optional(),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const missing: string[] = [];
  const invalid: string[] = [];

  for (const issue of result.error.issues) {
    const name = issue.path.join(".");
    if (issue.code === "invalid_type" && issue.received === "undefined") {
      missing.push(name);
    } else {
      invalid.push(`${name}: ${issue.message}`);
    }
  }

  console.error("\n========================================");
  console.error(" ENV VALIDATION FAILED — server cannot start");
  console.error("========================================\n");
  if (missing.length) {
    console.error("Missing required variables:");
    missing.forEach((v) => console.error(`  - ${v}`));
  }
  if (invalid.length) {
    console.error("Invalid variables:");
    invalid.forEach((v) => console.error(`  - ${v}`));
  }
  console.error("\nCheck your .env file and ensure all required variables are set.\n");
  process.exit(1);
}
