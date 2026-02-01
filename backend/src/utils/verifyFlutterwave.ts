export function verifyFlutterwaveHash(hash: string | undefined): boolean {
  if (!hash || !process.env.FLW_WEBHOOK_HASH) {
    return false;
  }
  return hash === process.env.FLW_WEBHOOK_HASH;
}
