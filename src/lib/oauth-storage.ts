import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const KEY_BYTES = 32;
const FORMAT = "v1";
// `import.meta.env` is injected by Astro. The Node test runner imports this
// module directly, so retain a conventional environment fallback there.
const isDev = import.meta.env?.DEV ?? process.env.NODE_ENV !== "production";

function configuredKey(): Buffer {
  const raw = import.meta.env?.OAUTH_STORAGE_KEY ?? process.env.OAUTH_STORAGE_KEY;
  if (!raw) {
    // Keeping local development zero-config is useful, but this deliberately
    // offers no protection outside a developer machine. Production always
    // requires a real, deployment-specific secret below.
    if (isDev) return createHash("sha256").update("devrelish-development-oauth-storage").digest();
    throw new Error("OAUTH_STORAGE_KEY must be configured in production");
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error("OAUTH_STORAGE_KEY must be a base64-encoded 32-byte key");
  }
  return key;
}

/** Fail early during app initialization instead of storing OAuth tokens in cleartext. */
export function assertOAuthStorageKeyConfigured(): void {
  configuredKey();
}

/** Encrypts a serialized OAuth state/session with AES-256-GCM. */
export function sealOAuthValue(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", configuredKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [FORMAT, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

/**
 * Decrypts a stored OAuth value. Production deliberately rejects the former
 * plaintext representation: it has no integrity protection and may contain a
 * refresh token. Existing production users simply reauthorize once on deploy.
 */
export function openOAuthValue(stored: string): string {
  const parts = stored.split(".");
  if (parts.length !== 4 || parts[0] !== FORMAT) {
    if (isDev && stored.startsWith("{")) return stored;
    throw new Error("Stored OAuth credentials use an unsupported format; reauthorization is required");
  }

  try {
    const [, ivEncoded, tagEncoded, ciphertextEncoded] = parts;
    const decipher = createDecipheriv("aes-256-gcm", configuredKey(), Buffer.from(ivEncoded, "base64url"));
    decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Stored OAuth credentials could not be decrypted; reauthorization is required");
  }
}
