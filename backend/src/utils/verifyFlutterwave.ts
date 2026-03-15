import crypto from "crypto";

/**
 * Verify Flutterwave webhook authenticity.
 * Supports both V3 (verif-hash header) and V4 (verif-hash or webhook_id presence).
 */
export function verifyFlutterwaveHash(hash: string | undefined): boolean {
  const webhookSecret = process.env.FLW_WEBHOOK_HASH;

  // If no webhook secret configured, skip hash verification but log warning
  if (!webhookSecret) {
    console.warn("FLW_WEBHOOK_HASH not configured — skipping webhook hash verification");
    return true;
  }

  if (!hash) {
    return false;
  }
  
  // Use timing-safe comparison to prevent timing attacks
  const expected = Buffer.from(webhookSecret, "utf8");
  const received = Buffer.from(hash, "utf8");
  
  if (expected.length !== received.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(expected, received);
}
