import crypto from "crypto";

export function verifyFlutterwaveHash(hash: string | undefined): boolean {
  if (!hash || !process.env.FLW_WEBHOOK_HASH) {
    return false;
  }
  
  // Use timing-safe comparison to prevent timing attacks
  const expected = Buffer.from(process.env.FLW_WEBHOOK_HASH, "utf8");
  const received = Buffer.from(hash, "utf8");
  
  if (expected.length !== received.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(expected, received);
}
