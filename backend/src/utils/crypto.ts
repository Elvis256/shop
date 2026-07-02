import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM

// Cache the derived key at module load to avoid blocking scryptSync on every call
let _cachedKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (_cachedKey) return _cachedKey;

  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is required. " +
      "Set a random 32+ character string in your .env file."
    );
  }

  // Use a per-environment salt derived from the key itself to avoid static salts
  const salt = crypto.createHash("sha256").update(`salt:${key}`).digest().subarray(0, 16);
  _cachedKey = crypto.scryptSync(key, salt, 32);
  return _cachedKey;
}

// Validate encryption key at startup (will throw if missing)
try {
  getEncryptionKey();
} catch (err: any) {
  console.error(`[FATAL] ${err.message}`);
  // Don't crash immediately — allow the app to boot for health checks,
  // but encrypt/decrypt will throw on use
}

/**
 * Encrypts a string using AES-256-GCM.
 * Output format: iv:authTag:ciphertext (all in hex)
 */
export function encrypt(text: string | null | undefined): string | null {
  if (text === null || text === undefined) return null;

  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 * Returns the original text as-is if it's not in encrypted format (backward compatible with legacy data).
 */
export function decrypt(encryptedText: string | null | undefined): string | null {
  if (!encryptedText) return null;

  const parts = encryptedText.split(":");
  if (parts.length !== 3) {
    // Not in iv:authTag:ciphertext format — legacy raw text
    return encryptedText;
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  if (ivHex.length !== 24 || authTagHex.length !== 32) {
    // Invalid hex sizes for IV/tag — legacy raw text
    return encryptedText;
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const key = getEncryptionKey();

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
