import { ShippingAddress } from "../types/shippingAddress";

/**
 * Parse a shipping address stored as a JSON string into a typed object.
 * Returns an empty object if the value is missing or invalid.
 *
 * This is a stepping-stone toward making `Order.shippingAddress` a Prisma
 * `Json` column. Until that migration is performed, data is still stored as an
 * encrypted string at rest, so we continue to parse it on read.
 */
export function parseShippingAddress(value: string | null | undefined | any): ShippingAddress {
  if (!value) return {};
  if (typeof value !== "string") return value as ShippingAddress;
  try {
    return JSON.parse(value) as ShippingAddress;
  } catch {
    return {};
  }
}

/**
 * Serialize a shipping address object for storage.
 */
export function stringifyShippingAddress(value: ShippingAddress | string | null | undefined): string {
  if (!value) return "{}";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}
