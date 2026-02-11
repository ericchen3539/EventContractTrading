/**
 * AES-256-GCM encryption for Site credentials (loginUsername, loginPassword).
 * Uses ENCRYPTION_KEY (32-byte hex) from env. If missing, returns plaintext (dev fallback).
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getKey(): Buffer | null {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== KEY_LENGTH * 2) return null;
  try {
    return Buffer.from(hex, "hex");
  } catch {
    return null;
  }
}

/**
 * Encrypt plaintext. Returns base64(iv || ciphertext || tag).
 * If ENCRYPTION_KEY is missing, returns plaintext as-is (dev fallback).
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]).toString("base64");
}

/**
 * Decrypt ciphertext. Expects base64(iv || ciphertext || tag).
 * If ENCRYPTION_KEY is missing or decrypt fails (e.g. plaintext stored), returns input as-is.
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  if (!key) return ciphertext;

  try {
    const buf = Buffer.from(ciphertext, "base64");
    if (buf.length < IV_LENGTH + TAG_LENGTH) return ciphertext;

    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(buf.length - TAG_LENGTH);
    const encrypted = buf.subarray(IV_LENGTH, buf.length - TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final("utf8");
  } catch {
    return ciphertext;
  }
}

/**
 * Check if a stored value is encrypted (base64 of iv+ct+tag).
 * Heuristic: encrypted values are base64 and have minimum length.
 */
export function isEncrypted(value: string): boolean {
  if (!value || value.length < 44) return false;
  try {
    const buf = Buffer.from(value, "base64");
    return buf.length >= IV_LENGTH + TAG_LENGTH;
  } catch {
    return false;
  }
}
