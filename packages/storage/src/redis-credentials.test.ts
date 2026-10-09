/**
 * Tests for `redisCredentialsFromEnv`.
 *
 * The regression these lock down actually shipped. On 2026-10-09 an Upstash store was created,
 * connected to the project and redeployed — and every limiter stayed on the per-instance
 * fallback, because Vercel's marketplace integration injects `KV_REST_API_*` while the code
 * only read `UPSTASH_REDIS_REST_*`. Nothing failed loudly. The dashboard said "connected".
 */
import { describe, expect, it } from 'vitest';
import { redisCredentialsFromEnv } from './rate-limit.js';

const UPSTASH = {
  UPSTASH_REDIS_REST_URL: 'https://upstash.example',
  UPSTASH_REDIS_REST_TOKEN: 'upstash-token',
} as const;

const VERCEL_KV = {
  KV_REST_API_URL: 'https://kv.example',
  KV_REST_API_TOKEN: 'kv-token',
} as const;

describe('redisCredentialsFromEnv', () => {
  it('reads the Upstash-native names', () => {
    expect(redisCredentialsFromEnv({ ...UPSTASH })).toEqual({
      redisUrl: 'https://upstash.example',
      redisToken: 'upstash-token',
    });
  });

  it("reads Vercel's KV_* names — the marketplace integration injects these", () => {
    expect(redisCredentialsFromEnv({ ...VERCEL_KV })).toEqual({
      redisUrl: 'https://kv.example',
      redisToken: 'kv-token',
    });
  });

  it('prefers UPSTASH_* when both are present, because that one was set on purpose', () => {
    expect(redisCredentialsFromEnv({ ...VERCEL_KV, ...UPSTASH })).toEqual({
      redisUrl: 'https://upstash.example',
      redisToken: 'upstash-token',
    });
  });

  it('returns nothing when neither convention is set', () => {
    expect(redisCredentialsFromEnv({})).toEqual({});
  });

  it('treats an empty string as unset, not as configured', () => {
    // Vercel writes an empty value rather than deleting a key when a variable is cleared.
    // If '' counted as configured, the Upstash adapter would be built against an empty URL and
    // every limiter call would throw instead of falling back.
    expect(
      redisCredentialsFromEnv({ UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '   ' }),
    ).toEqual({});
  });

  it('falls through to KV_* when the UPSTASH_* names are present but blank', () => {
    expect(
      redisCredentialsFromEnv({
        UPSTASH_REDIS_REST_URL: '',
        UPSTASH_REDIS_REST_TOKEN: '',
        ...VERCEL_KV,
      }),
    ).toEqual({ redisUrl: 'https://kv.example', redisToken: 'kv-token' });
  });

  it('omits a half-configured pair rather than inventing one', () => {
    // A URL with no token must not produce a partially-populated object that reads as usable.
    expect(redisCredentialsFromEnv({ KV_REST_API_URL: 'https://kv.example' })).toEqual({
      redisUrl: 'https://kv.example',
    });
    expect(redisCredentialsFromEnv({ KV_REST_API_TOKEN: 'kv-token' })).toEqual({
      redisToken: 'kv-token',
    });
  });

  it('ignores the read-only token, which cannot increment a counter', () => {
    // Vercel also injects KV_REST_API_READ_ONLY_TOKEN. A rate limiter WRITES, so picking that
    // one up would produce a limiter that fails on every call.
    expect(
      redisCredentialsFromEnv({
        KV_REST_API_URL: 'https://kv.example',
        KV_REST_API_READ_ONLY_TOKEN: 'read-only',
      }),
    ).toEqual({ redisUrl: 'https://kv.example' });
  });
});
