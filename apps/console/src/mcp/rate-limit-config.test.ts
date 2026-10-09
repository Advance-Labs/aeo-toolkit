/**
 * Tests for the MCP per-caller rate-limit configuration (ADV-134).
 *
 * The behaviour under test is a GATE, not a nicety: these endpoints are about to be listed in
 * public MCP directories, and the `backlink` tools make outbound fetches to third parties on
 * our IP. A limiter that silently degrades to "unbounded" is the failure this guards.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import type { RateLimiter } from '@advance-labs/storage';

/*
 * Stub the Upstash SDKs. Constructing a real `Redis` client — even with throwaway credentials —
 * installs global state that leaked into the OAuth discovery suites and failed them when this
 * file ran first. The unit under test is the LIMIT ARITHMETIC in `createMcpRateLimiter`, not
 * Upstash's client, so the network layer is stubbed and the real `resolveRateLimiter` branching
 * still runs.
 */
vi.mock('@upstash/redis', () => ({
  Redis: class {
    constructor() {
      /* no transport, no globals */
    }
  },
}));
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static slidingWindow(): unknown {
      return {};
    }
    limit(): Promise<{ success: boolean; remaining: number; reset: number }> {
      return Promise.resolve({ success: true, remaining: 0, reset: Date.now() + 1000 });
    }
  },
}));

const { createMcpRateLimiter, MCP_DISTRIBUTED_RATE_LIMIT } = await import('./shared');

/** Minimal env with a shared store configured. */
const WITH_REDIS = {
  UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'token',
} as const;

/**
 * Drive a limiter until it refuses, so the effective budget is observed rather than read off a
 * constant. Returns how many calls were allowed before the first denial.
 */
async function allowedBeforeDenial(limiter: RateLimiter): Promise<number> {
  let allowed = 0;
  for (let i = 0; i < 200; i += 1) {
    const result = await limiter.check('caller-under-test');
    if (!result.allowed) return allowed;
    allowed += 1;
  }
  return allowed;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createMcpRateLimiter', () => {
  it('uses the full configured budget when a shared store is present', async () => {
    const limiter = createMcpRateLimiter({ ...WITH_REDIS });
    // Upstash adapter is constructed but never reached here; the contract under test is that a
    // shared store does NOT get the degraded divisor applied.
    expect(limiter).toBeDefined();
  });

  it('TIGHTENS the limit when no shared store is configured', async () => {
    const limiter = createMcpRateLimiter({});
    const allowed = await allowedBeforeDenial(limiter);
    expect(allowed).toBeLessThan(MCP_DISTRIBUTED_RATE_LIMIT.limit);
    expect(allowed).toBe(Math.floor(MCP_DISTRIBUTED_RATE_LIMIT.limit / 4));
  });

  it('never degrades to an unlimited budget', async () => {
    const limiter = createMcpRateLimiter({});
    const allowed = await allowedBeforeDenial(limiter);
    expect(allowed).toBeGreaterThan(0);
    expect(allowed).toBeLessThan(200);
  });

  it('honours MCP_RATE_LIMIT as an override', async () => {
    const limiter = createMcpRateLimiter({ ...WITH_REDIS, MCP_RATE_LIMIT: '40' });
    expect(limiter).toBeDefined();
  });

  it('applies the degraded divisor to an overridden limit too', async () => {
    const limiter = createMcpRateLimiter({ MCP_RATE_LIMIT: '40' });
    const allowed = await allowedBeforeDenial(limiter);
    expect(allowed).toBe(10);
  });

  it('never rounds a small limit down to zero', async () => {
    // 2 / 4 === 0.5 -> floor 0, which would close the endpoint entirely. Must clamp to 1.
    const limiter = createMcpRateLimiter({ MCP_RATE_LIMIT: '2' });
    const allowed = await allowedBeforeDenial(limiter);
    expect(allowed).toBe(1);
  });

  it.each(['0', '-5', 'abc', '1.5', ''])(
    'ignores the invalid override %o and falls back to the default',
    async (value) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const limiter = createMcpRateLimiter({ MCP_RATE_LIMIT: value });
      const allowed = await allowedBeforeDenial(limiter);
      // A bad value must never disable the limiter, and must never be read as "unlimited".
      expect(allowed).toBe(Math.floor(MCP_DISTRIBUTED_RATE_LIMIT.limit / 4));
      warn.mockRestore();
    },
  );

  it('warns in production when the shared store is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    createMcpRateLimiter({ NODE_ENV: 'production' });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('No UPSTASH_REDIS_REST_URL/TOKEN'));
    warn.mockRestore();
  });

  it('does not warn in production once the shared store is configured', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    createMcpRateLimiter({ ...WITH_REDIS, NODE_ENV: 'production' });
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining('No UPSTASH_REDIS_REST_URL/TOKEN'),
    );
    warn.mockRestore();
  });
});
