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
