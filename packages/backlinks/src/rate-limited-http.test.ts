import { describe, it, expect, vi } from 'vitest';
import type { RateLimiter, RateLimitResult } from '@aeo/storage';
import type { PageResource } from '@aeo/types';
import { createRateLimitedHttpClient } from './rate-limited-http.js';
import type { HttpClient, TextResponse } from './http.js';

const OK_TEXT: TextResponse = { ok: true, status: 200, body: 'hello', url: 'https://x/' };

function fakeInner(overrides: Partial<HttpClient> = {}): HttpClient {
  return {
    getText: async () => OK_TEXT,
    getResource: async () =>
      ({ url: 'https://x/', status: 200, body: '' }) as unknown as PageResource,
    ...overrides,
  };
}

function limiterReturning(result: RateLimitResult): RateLimiter {
  return { check: async () => result };
}

describe('createRateLimitedHttpClient', () => {
  it('delegates getText to the inner client when the limiter allows', async () => {
    const inner = fakeInner();
    const spy = vi.spyOn(inner, 'getText');
    const client = createRateLimitedHttpClient(
      inner,
      limiterReturning({ allowed: true, remaining: 9, resetSeconds: 60 }),
    );

    const res = await client.getText('https://example.com', { accept: 'text/html' });
    expect(res).toEqual(OK_TEXT);
    expect(spy).toHaveBeenCalledWith('https://example.com', { accept: 'text/html' });
  });

  it('degrades to a 429 non-ok response (never throws) when the limiter denies', async () => {
    const inner = fakeInner();
    const spy = vi.spyOn(inner, 'getText');
    const client = createRateLimitedHttpClient(
      inner,
      limiterReturning({ allowed: false, remaining: 0, resetSeconds: 30 }),
    );

    const res = await client.getText('https://example.com');
    expect(res.ok).toBe(false);
    expect(res.status).toBe(429);
    expect(res.body).toBe('');
    // The inner client is NOT called when denied — we shed the request politely.
    expect(spy).not.toHaveBeenCalled();
  });

  it('fails open (allows the request) when the limiter backend throws', async () => {
    const inner = fakeInner();
    const spy = vi.spyOn(inner, 'getText');
    const throwingLimiter: RateLimiter = {
      check: async () => {
        throw new Error('redis down');
      },
    };
    const client = createRateLimitedHttpClient(inner, throwingLimiter);

    const res = await client.getText('https://example.com');
    expect(res).toEqual(OK_TEXT);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('uses a shared bucket key by default and a custom key when provided', async () => {
    const seenKeys: string[] = [];
    const limiter: RateLimiter = {
      check: async (key) => {
        seenKeys.push(key);
        return { allowed: true, remaining: 1, resetSeconds: 1 };
      },
    };
    const defaultClient = createRateLimitedHttpClient(fakeInner(), limiter);
    await defaultClient.getText('https://a');

    const customClient = createRateLimitedHttpClient(fakeInner(), limiter, 'custom:key');
    await customClient.getText('https://b');

    expect(seenKeys).toEqual(['backlink:scrape', 'custom:key']);
  });

  it('throttles getResource but still returns the page resource', async () => {
    const resource = { url: 'https://x/', status: 200, body: '' } as unknown as PageResource;
    const inner = fakeInner({ getResource: async () => resource });
    const checks: string[] = [];
    const limiter: RateLimiter = {
      check: async (key) => {
        checks.push(key);
        return { allowed: false, remaining: 0, resetSeconds: 5 };
      },
    };
    const client = createRateLimitedHttpClient(inner, limiter);

    const out = await client.getResource('https://x/');
    // getResource has no graceful empty form, so it still resolves even when the
    // limiter would deny — but the limiter is consulted (polite-by-default).
    expect(out).toBe(resource);
    expect(checks).toHaveLength(1);
  });
});
