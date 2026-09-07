/**
 * Server-only AES-256-GCM symmetric encryption utilities.
 *
 * Used by the OAuth callback and sync routes to encrypt OAuth access/refresh
 * tokens before persisting them to the database, and to decrypt them again at
 * retrieval time. Never import this module from a client component — it relies
 * on the Node.js `crypto` module and a server-side ENCRYPTION_KEY env var.
 *
 * Cipher format (hex-encoded): iv (12 bytes) + ciphertext + authTag (16 bytes).
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Resolve the 32-byte AES-256 key from the ENCRYPTION_KEY env var.
 * The key must be supplied as a 64-character hex string.
 */
function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  }
  return Buffer.from(key, "hex");
}

/**
 * Encrypt a plaintext string. Returns a hex-encoded string:
 * iv (12 bytes) + ciphertext + authTag (16 bytes)
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]).toString("hex");
}

/**
 * Decrypt a hex-encoded string produced by encrypt().
 */
export function decrypt(cipherHex: string): string {
  const key = getKey();
  const data = Buffer.from(cipherHex, "hex");
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(data.length - TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH, data.length - TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}
