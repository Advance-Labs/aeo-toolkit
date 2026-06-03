/**
 * Pure AES-256-GCM helpers for encrypting OAuth tokens at rest.
 *
 * A 256-bit key is derived from a caller-supplied passphrase via scrypt (with a fixed,
 * non-secret salt so the same passphrase always yields the same key — the secret is the
 * passphrase, not the salt). Each `encrypt` uses a fresh random 12-byte IV. The serialized
 * payload packs `iv | authTag | ciphertext` and base64-encodes the whole thing so it round-trips
 * cleanly through a text column.
 *
 * No I/O here — these are deterministic-given-IV functions, unit-tested in isolation.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

/**
 * Fixed application salt for key derivation. This is intentionally not a secret: scrypt's salt
 * defends against rainbow tables across *different* passphrases, while confidentiality here rests
 * on the secret passphrase. Keeping it fixed lets ciphertext written by one process decrypt in
 * another without coordinating a per-row salt column.
 */
const KEY_DERIVATION_SALT = 'aeo-toolkit::storage::token-store::v1';

/** Thrown when ciphertext is malformed or authentication fails (wrong key / tampered data). */
export class TokenCryptoError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'TokenCryptoError';
  }
}

/** Derive a stable 256-bit key from a passphrase. Pure and deterministic. */
export function deriveKey(passphrase: string): Buffer {
  if (passphrase.length === 0) {
    throw new TokenCryptoError('encryptionKey passphrase must be a non-empty string');
  }
  return scryptSync(passphrase, KEY_DERIVATION_SALT, KEY_LENGTH_BYTES);
}

/**
 * Encrypt UTF-8 plaintext with the derived key, returning a base64 string of
 * `iv (12 bytes) | authTag (16 bytes) | ciphertext`.
 */
export function encrypt(plaintext: string, passphrase: string): string {
  const key = deriveKey(passphrase);
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

/** Decrypt a payload produced by {@link encrypt}. Throws {@link TokenCryptoError} on any failure. */
export function decrypt(payload: string, passphrase: string): string {
  const key = deriveKey(passphrase);

  let raw: Buffer;
  try {
    raw = Buffer.from(payload, 'base64');
  } catch (cause) {
    throw new TokenCryptoError('ciphertext is not valid base64', { cause });
  }

  if (raw.length < IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES) {
    throw new TokenCryptoError('ciphertext is too short to contain an IV and auth tag');
  }

  const iv = raw.subarray(0, IV_LENGTH_BYTES);
  const authTag = raw.subarray(IV_LENGTH_BYTES, IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);
  const ciphertext = raw.subarray(IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch (cause) {
    throw new TokenCryptoError('failed to decrypt ciphertext (wrong key or tampered data)', {
      cause,
    });
  }
}
