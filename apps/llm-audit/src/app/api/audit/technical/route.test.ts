import { describe, expect, it } from 'vitest';
import type { RateLimiter, RateLimitResult } from '../../../../lib/rate-limit.js';
import { handleAudit } from '../../../../lib/handle-audit.js';

/** Deterministic limiter fake — no Redis, no shared state, fully offline. */
function fakeLimiter(result: RateLimitResult): RateLimiter {
  return { check: (): Promise<RateLimitResult> => Promise.resolve(result) };
}

function postRequest(body: string): Request {
  return new Request('https://audit.example/api/audit/technical', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
    body,
  });
}

describe('handleAudit rate limiting', () => {
  it('returns 429 with a Retry-After header derived from resetSeconds when blocked', async () => {
    const limiter = fakeLimiter({ allowed: false, remaining: 0, resetSeconds: 42 });
    const res = await handleAudit(postRequest('{}'), limiter);

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('42');

    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('rate_limited');
  });

  it('lets the request through when allowed (proceeds to body validation)', async () => {
    const limiter = fakeLimiter({ allowed: true, remaining: 9, resetSeconds: 600 });
    // Invalid JSON short-circuits to a 400 before any crawl — proving the limiter did not block.
    const res = await handleAudit(postRequest('not json'), limiter);

    expect(res.status).toBe(400);
    expect(res.headers.get('Retry-After')).toBeNull();

    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('invalid_request');
  });
});
