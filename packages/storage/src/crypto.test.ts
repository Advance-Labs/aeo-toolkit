import { describe, expect, it } from 'vitest';
import { decrypt, deriveKey, encrypt, TokenCryptoError } from './crypto.js';

const PASSPHRASE = 'correct horse battery staple';

describe('encrypt/decrypt', () => {
  it('round-trips plaintext and produces ciphertext distinct from the input', () => {
    const plaintext = 'ya29.a0AfH6SMC-secret-access-token';
    const ciphertext = encrypt(plaintext, PASSPHRASE);

    // Ciphertext must not leak the plaintext.
    expect(ciphertext).not.toBe(plaintext);
    expect(ciphertext).not.toContain(plaintext);

    // And it must decrypt back to exactly the original.
    expect(decrypt(ciphertext, PASSPHRASE)).toBe(plaintext);
  });

  it('uses a fresh IV so the same plaintext encrypts to different ciphertext each time', () => {
    const a = encrypt('same-value', PASSPHRASE);
    const b = encrypt('same-value', PASSPHRASE);
    expect(a).not.toBe(b);
    expect(decrypt(a, PASSPHRASE)).toBe('same-value');
    expect(decrypt(b, PASSPHRASE)).toBe('same-value');
  });

  it('round-trips an empty string', () => {
    const ciphertext = encrypt('', PASSPHRASE);
    expect(decrypt(ciphertext, PASSPHRASE)).toBe('');
  });

  it('fails to decrypt with the wrong passphrase (auth tag mismatch)', () => {
    const ciphertext = encrypt('secret', PASSPHRASE);
    expect(() => decrypt(ciphertext, 'wrong passphrase')).toThrow(TokenCryptoError);
  });

  it('rejects ciphertext that is too short to hold an IV and auth tag', () => {
    const tooShort = Buffer.from('short').toString('base64');
    expect(() => decrypt(tooShort, PASSPHRASE)).toThrow(TokenCryptoError);
  });

  it('rejects an empty passphrase at key derivation', () => {
    expect(() => deriveKey('')).toThrow(TokenCryptoError);
    expect(() => encrypt('x', '')).toThrow(TokenCryptoError);
  });

  it('derives a stable 32-byte key for the same passphrase', () => {
    const k1 = deriveKey(PASSPHRASE);
    const k2 = deriveKey(PASSPHRASE);
    expect(k1.length).toBe(32);
    expect(k1.equals(k2)).toBe(true);
  });
});

describe('key-versioned ciphertext (rotation support, H4)', () => {
  it('tags fresh ciphertext with the current "v1:" key-version prefix', () => {
    const payload = encrypt('secret', PASSPHRASE);
    expect(payload.startsWith('v1:')).toBe(true);
    // The body after the prefix is the base64 iv|authTag|ciphertext, not the plaintext.
    expect(payload).not.toContain('secret');
  });

  it('round-trips a versioned payload', () => {
    const payload = encrypt('ya29.versioned-token', PASSPHRASE);
    expect(decrypt(payload, PASSPHRASE)).toBe('ya29.versioned-token');
  });

  it('still decrypts a legacy (un-prefixed) payload for backward compatibility', () => {
    // Rows written before key-versioning have no "vN:" prefix — strip it to simulate one.
    const versioned = encrypt('legacy-token', PASSPHRASE);
    const legacy = versioned.slice('v1:'.length);
    // The stripped payload has no "vN:" version prefix (':' is not a base64 char, so this is
    // deterministic regardless of the random ciphertext bytes).
    expect(legacy.startsWith('v1:')).toBe(false);
    expect(decrypt(legacy, PASSPHRASE)).toBe('legacy-token');
  });

  it('rejects an unknown/future key version rather than mis-decrypting it', () => {
    const versioned = encrypt('token', PASSPHRASE);
    const body = versioned.slice('v1:'.length);
    expect(() => decrypt(`v99:${body}`, PASSPHRASE)).toThrow(TokenCryptoError);
  });

  it('rejects arbitrary garbage instead of returning it as plaintext', () => {
    // The single most important security property: a non-ciphertext value must NOT round-trip
    // back out of decrypt() as if it were a plaintext token.
    expect(() => decrypt('not-actually-ciphertext', PASSPHRASE)).toThrow(TokenCryptoError);
    expect(() => decrypt('v1:not-actually-ciphertext', PASSPHRASE)).toThrow(TokenCryptoError);
  });
});
