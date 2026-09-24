import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MONTHLY_BUDGET,
  RATE_LIMIT_DOMAINS,
  RATE_LIMIT_REQUESTS,
  RATE_LIMIT_WINDOW_SECONDS,
  callerKey,
  checkMonthlyBudget,
  checkRateLimit,
  recordSpend,
} from './authority-limits';
import type { AuthorityCacheStore } from './authority-cache';

function memoryStore(seed: Record<string, unknown> = {}) {
  const data = new Map<string, unknown>(Object.entries(seed));
  const store: AuthorityCacheStore = {
    get: async (key) => data.get(key),
    set: async (key, value) => {
      data.set(key, value);
    },
  };
  return { store, data };
}

/** A fixed instant, so window arithmetic is deterministic. */
const T0 = Date.UTC(2026, 8, 24, 12, 0, 0);
const now = () => T0;

describe('callerKey', () => {
  it('takes the leftmost x-forwarded-for entry', () => {
    const request = new Request('https://x.test', {
      headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
    });
    expect(callerKey(request)).toBe('203.0.113.7');
  });

  it('falls back to x-real-ip', () => {
    const request = new Request('https://x.test', { headers: { 'x-real-ip': '203.0.113.9' } });
    expect(callerKey(request)).toBe('203.0.113.9');
  });

  /**
   * Unidentified callers share one bucket. That is stricter than giving each its
   * own, which is the correct direction to err on a free endpoint.
   */
  it('buckets unidentifiable callers together rather than exempting them', () => {
    expect(callerKey(new Request('https://x.test'))).toBe('unidentified');
  });
});

describe('checkRateLimit', () => {
  it('allows a caller under both ceilings', async () => {
    const { store } = memoryStore();
    expect(await checkRateLimit('1.1.1.1', 1, { store, now })).toMatchObject({ allowed: true });
  });

  it('blocks once the request ceiling is reached', async () => {
    const { store } = memoryStore();
    for (let i = 0; i < RATE_LIMIT_REQUESTS; i += 1) {
      await checkRateLimit('1.1.1.1', 1, { store, now });
    }

    const decision = await checkRateLimit('1.1.1.1', 1, { store, now });
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('rate_limited');
    expect(decision.retryAfterSeconds).toBeGreaterThan(0);
    expect(decision.retryAfterSeconds).toBeLessThanOrEqual(RATE_LIMIT_WINDOW_SECONDS);
  });

  /**
   * The ceiling that actually matters: the endpoint takes 100 domains per call, so
   * a request ceiling alone would let a handful of calls drain the month.
   */
  it('blocks a small number of very large batches on the domain ceiling', async () => {
    const { store } = memoryStore();
    await checkRateLimit('1.1.1.1', 100, { store, now });

    const decision = await checkRateLimit('1.1.1.1', 100, { store, now });
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('rate_limited');
  });

  it('counts each caller separately', async () => {
    const { store } = memoryStore();
    for (let i = 0; i < RATE_LIMIT_REQUESTS; i += 1) {
      await checkRateLimit('1.1.1.1', 1, { store, now });
    }

    expect(await checkRateLimit('2.2.2.2', 1, { store, now })).toMatchObject({ allowed: true });
  });

  it('lets a blocked caller back in on the next window', async () => {
    const { store } = memoryStore();
    for (let i = 0; i < RATE_LIMIT_REQUESTS; i += 1) {
      await checkRateLimit('1.1.1.1', 1, { store, now });
    }
    expect(await checkRateLimit('1.1.1.1', 1, { store, now })).toMatchObject({ allowed: false });

    const later = () => T0 + (RATE_LIMIT_WINDOW_SECONDS + 1) * 1000;
    expect(await checkRateLimit('1.1.1.1', 1, { store, now: later })).toMatchObject({
      allowed: true,
    });
  });

  it('allows a batch that exactly reaches the domain ceiling', async () => {
    const { store } = memoryStore();
    expect(await checkRateLimit('1.1.1.1', RATE_LIMIT_DOMAINS, { store, now })).toMatchObject({
      allowed: true,
    });
  });

  it('fails open when the store is broken, rather than 500ing a free tool', async () => {
    const store: AuthorityCacheStore = {
      get: async () => {
        throw new Error('down');
      },
      set: async () => {
        throw new Error('down');
      },
    };
    expect(await checkRateLimit('1.1.1.1', 1, { store, now })).toMatchObject({ allowed: true });
  });
});

describe('checkMonthlyBudget', () => {
  it('allows while the month has room', async () => {
    const { store } = memoryStore();
    expect(await checkMonthlyBudget({ store, now, env: {} })).toMatchObject({ allowed: true });
  });

  it('blocks once the ceiling is reached, with copy that blames us and not the domain', async () => {
    const { store } = memoryStore({ 'authority:budget:2026-09': DEFAULT_MONTHLY_BUDGET });

    const decision = await checkMonthlyBudget({ store, now, env: {} });
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('quota_exhausted');
    expect(decision.message).toMatch(/your domain is fine/i);
  });

  it('honours an explicit override', async () => {
    const { store } = memoryStore({ 'authority:budget:2026-09': 10 });
    const env = { AUTHORITY_MONTHLY_DOMAIN_BUDGET: '10' };
    expect(await checkMonthlyBudget({ store, now, env })).toMatchObject({ allowed: false });
  });

  /**
   * An unparseable override must not disable the only thing protecting the quota.
   */
  it('falls back to the safe default when the override is junk', async () => {
    const { store } = memoryStore({ 'authority:budget:2026-09': DEFAULT_MONTHLY_BUDGET });
    const env = { AUTHORITY_MONTHLY_DOMAIN_BUDGET: 'lots' };
    expect(await checkMonthlyBudget({ store, now, env })).toMatchObject({ allowed: false });
  });

  it('starts a fresh count in a new month', async () => {
    const { store } = memoryStore({ 'authority:budget:2026-09': DEFAULT_MONTHLY_BUDGET });
    const october = () => Date.UTC(2026, 9, 1, 0, 0, 0);
    expect(await checkMonthlyBudget({ store, now: october, env: {} })).toMatchObject({
      allowed: true,
    });
  });
});

describe('recordSpend', () => {
  it('meters misses only, so cache hits cost no budget', async () => {
    const { store, data } = memoryStore();
    await recordSpend(3, { store, now });
    await recordSpend(0, { store, now });

    expect(data.get('authority:budget:2026-09')).toBe(3);
  });

  it('accumulates across calls', async () => {
    const { store, data } = memoryStore();
    await recordSpend(2, { store, now });
    await recordSpend(5, { store, now });

    expect(data.get('authority:budget:2026-09')).toBe(7);
  });

  it('reads back a counter the store returned as a string', async () => {
    const { store, data } = memoryStore({ 'authority:budget:2026-09': '4' });
    await recordSpend(1, { store, now });

    expect(data.get('authority:budget:2026-09')).toBe(5);
  });
});
