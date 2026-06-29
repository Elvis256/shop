import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    // Fallback to JWT_SECRET to ensure app boots up even if ENCRYPTION_KEY isn't in env yet
    const fallback = process.env.JWT_SECRET || "fallback_pleasurezone_secret_key_32_bytes";
    return crypto.scryptSync(fallback, "salt_pleasurezone", 32);
  }
  return crypto.scryptSync(key, "salt_pleasurezone", 32);
}

/**
 * Encrypts a string using AES-256-GCM.
 * Output format: iv:authTag:ciphertext (all in hex)
 */
export function encrypt(text: string | null | undefined): string | null {
  if (text === null || text === undefined) return null;
  
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getEncryptionKey();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    const authTag = cipher.getAuthTag().toString("hex");
    
    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
  } catch (error) {
    return text;
  }
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 * Returns the original text as-is if it's not encrypted (backward compatible with legacy data).
 */
export function decrypt(encryptedText: string | null | undefined): string | null {
  if (!encryptedText) return null;
  
  try {
    const parts = encryptedText.split(":");
    if (parts.length !== 3) {
      // If it doesn't match the format iv:authTag:ciphertext, it is legacy raw text
      return encryptedText;
    }
    
    const [ivHex, authTagHex, ciphertextHex] = parts;
    if (ivHex.length !== 24 || authTagHex.length !== 32) {
      // Invalid hex sizes for IV/tag implies raw text
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
  } catch (error) {
    // On decryption failure, fallback to raw text to ensure resiliency
    return encryptedText;
  }
}
