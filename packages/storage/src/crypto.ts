/**
 * Pure AES-256-GCM helpers for encrypting OAuth tokens at rest.
 *
 * A 256-bit key is derived from a caller-supplied passphrase via scrypt (with a fixed,
 * non-secret salt so the same passphrase always yields the same key — the secret is the
 * passphrase, not the salt). Each `encrypt` uses a fresh random 12-byte IV. The serialized
 * payload packs `iv | authTag | ciphertext`, base64-encodes that body, and prefixes it with a
 * key-version tag (`v1:`) so the at-rest format can evolve and keys can be rotated (security §H4).
 *
 * ## Key-version prefix (rotation, §H4)
 * `encrypt` always emits the *current* version (`v1:<base64>`). `decrypt`:
 *   - recognises the `vN:` prefix and dispatches to the matching scheme;
 *   - accepts a legacy, un-prefixed body (rows written before versioning) by treating it as v1;
 *   - rejects an unknown/future version (`vN:` with no decoder) with a clear error rather than
 *     silently mis-decrypting it.
 * Adding a future scheme (a new derivation/algorithm, a rotated key) is a matter of registering a
 * new `vN` decoder here while old ciphertext keeps decrypting — see `ROTATION.md`.
 *
 * No I/O here — these are deterministic-given-IV functions, unit-tested in isolation.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

/** Current at-rest key/scheme version stamped onto fresh ciphertext. */
export const CURRENT_KEY_VERSION = 'v1';

/** Matches a leading `vN:` key-version tag and captures the integer version. */
const VERSION_PREFIX_RE = /^v(\d+):/;

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
 * Encrypt UTF-8 plaintext with the derived key. Returns `v1:<base64>` where the base64 body is
 * `iv (12 bytes) | authTag (16 bytes) | ciphertext`. The `v1:` prefix is the key-version tag.
 */
export function encrypt(plaintext: string, passphrase: string): string {
  const key = deriveKey(passphrase);
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const body = Buffer.concat([iv, authTag, ciphertext]).toString('base64');
  return `${CURRENT_KEY_VERSION}:${body}`;
}

/**
 * Decrypt a payload produced by {@link encrypt}. Tolerates the current `v1:` format and a legacy
 * un-prefixed body (treated as v1 for backward compatibility); rejects an unknown/future version
 * and any malformed/garbage input with {@link TokenCryptoError}. Throws on any failure — never
 * returns the input verbatim.
 */
export function decrypt(payload: string, passphrase: string): string {
  const match = VERSION_PREFIX_RE.exec(payload);
  if (match) {
    const version = match[1];
    const body = payload.slice(match[0].length);
    if (version === '1') {
      return decryptV1(body, passphrase);
    }
    // Recognised the version tag but have no decoder for it (a future scheme). Fail loudly rather
    // than fall through to v1 and mis-decrypt — register the new decoder here when it lands.
    throw new TokenCryptoError(`unsupported ciphertext key version v${version}`);
  }
  // No version tag → a row written before key-versioning. Decode it with the original v1 scheme.
  return decryptV1(payload, passphrase);
}

/** Decode a v1 body: base64 of `iv | authTag | ciphertext`. */
function decryptV1(body: string, passphrase: string): string {
  const key = deriveKey(passphrase);

  let raw: Buffer;
  try {
    raw = Buffer.from(body, 'base64');
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
