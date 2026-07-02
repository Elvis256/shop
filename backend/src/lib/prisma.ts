import { PrismaClient } from "@prisma/client";
import { encrypt, decrypt } from "../utils/crypto";

declare global {
  var prisma: any;
}

// Append connection pool params if not already present
// If using pgBouncer (port 6432), use pgbouncer=true for compatibility
function getDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return url;
  if (url.includes("connection_limit") || url.includes("pool_timeout")) return url;
  const sep = url.includes("?") ? "&" : "?";
  const poolSize = process.env.DB_POOL_SIZE || "15";
  const pgbouncerParam = url.includes(":6432") ? "&pgbouncer=true" : "";
  return `${url}${sep}connection_limit=${poolSize}&pool_timeout=10&statement_timeout=30000${pgbouncerParam}`;
}

const basePrisma =
  globalThis.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === "production"
        ? ["error", "warn"]
        : ["query", "error", "warn"],
    datasources: {
      db: { url: getDatabaseUrl() },
    },
  });

function encryptPrismaValue(value: any): any {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return encrypt(value);
  }
  if (typeof value === "object" && typeof value.set === "string") {
    return { ...value, set: encrypt(value.set) };
  }
  return value;
}

const extendedPrisma = basePrisma.$extends({
  query: {
    order: {
      async create({ args, query }) {
        if (args.data) {
          args.data.customerName = encryptPrismaValue(args.data.customerName);
          args.data.customerPhone = encryptPrismaValue(args.data.customerPhone);
          args.data.shippingAddress = encryptPrismaValue(args.data.shippingAddress);
        }
        return query(args);
      },
      async update({ args, query }) {
        if (args.data) {
          if (args.data.customerName !== undefined) args.data.customerName = encryptPrismaValue(args.data.customerName);
          if (args.data.customerPhone !== undefined) args.data.customerPhone = encryptPrismaValue(args.data.customerPhone);
          if (args.data.shippingAddress !== undefined) args.data.shippingAddress = encryptPrismaValue(args.data.shippingAddress);
        }
        return query(args);
      },
      async upsert({ args, query }) {
        if (args.create) {
          args.create.customerName = encryptPrismaValue(args.create.customerName);
          args.create.customerPhone = encryptPrismaValue(args.create.customerPhone);
          args.create.shippingAddress = encryptPrismaValue(args.create.shippingAddress);
        }
        if (args.update) {
          if (args.update.customerName !== undefined) args.update.customerName = encryptPrismaValue(args.update.customerName);
          if (args.update.customerPhone !== undefined) args.update.customerPhone = encryptPrismaValue(args.update.customerPhone);
          if (args.update.shippingAddress !== undefined) args.update.shippingAddress = encryptPrismaValue(args.update.shippingAddress);
        }
        return query(args);
      },
    },
  },
  result: {
    order: {
      customerName: {
        needs: { customerName: true },
        compute(order) {
          return decrypt(order.customerName) || "";
        },
      },
      customerPhone: {
        needs: { customerPhone: true },
        compute(order) {
          return decrypt(order.customerPhone) || "";
        },
      },
      shippingAddress: {
        needs: { shippingAddress: true },
        compute(order) {
          return decrypt(order.shippingAddress) || "";
        },
      },
    },
  },
});

export const prisma = extendedPrisma as any as PrismaClient;

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = basePrisma;
}

export default prisma;
