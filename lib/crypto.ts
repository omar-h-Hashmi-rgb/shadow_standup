import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Application-level encryption for secrets stored in the database
 * (webhook URLs, Jira/Trello tokens, GitHub tokens).
 *
 * AES-256-GCM, random 96-bit IV per value, key from ENCRYPTION_KEY
 * (32 random bytes, base64). Stored as "enc:v1:<iv>.<tag>.<ciphertext>".
 *
 * Backwards compatible: values without the prefix are treated as legacy
 * plaintext and returned unchanged, so existing rows keep working and are
 * re-encrypted the next time they are saved.
 *
 * Generate a key with:  openssl rand -base64 32
 */

const PREFIX = "enc:v1:";
let warned = false;

function getKey(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes, base64-encoded (openssl rand -base64 32).");
  }
  return key;
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptSecret(plain: string): string {
  if (!plain) return "";
  const key = getKey();
  if (!key) {
    if (!warned) {
      warned = true;
      console.warn(
        "[security] ENCRYPTION_KEY is not set: secrets are being stored UNENCRYPTED. " +
          "Generate one with `openssl rand -base64 32` and add it to .env.local."
      );
    }
    return plain;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}.${tag.toString("base64")}.${ciphertext.toString("base64")}`;
}

export function decryptSecret(stored: string | null | undefined): string {
  if (!stored) return "";
  if (!isEncrypted(stored)) return stored; // legacy plaintext

  const key = getKey();
  if (!key) {
    console.error("[security] Encrypted value found but ENCRYPTION_KEY is not set.");
    return "";
  }
  try {
    const [ivB64, tagB64, dataB64] = stored.slice(PREFIX.length).split(".");
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    console.error("[security] Failed to decrypt a stored secret (wrong ENCRYPTION_KEY or corrupted value).");
    return "";
  }
}
