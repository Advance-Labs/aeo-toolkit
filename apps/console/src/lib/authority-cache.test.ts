import { describe, expect, it, vi } from 'vitest';
import { DOMAIN_TTL_SECONDS, lookupAuthorityCached } from './authority-cache';
import type { AuthorityCacheStore } from './authority-cache';
import { AuthorityError } from './authority';

/**
 * A Map-backed store standing in for Vercel's Runtime Cache, plus counters so a
 * test can assert what was read and written rather than only what came back.
 */
function memoryStore(seed: Record<string, unknown> = {}) {
  const data = new Map<string, unknown>(Object.entries(seed));
  const sets: { key: string; value: unknown; ttl?: number }[] = [];
  const store: AuthorityCacheStore = {
    get: async (key) => data.get(key),
    set: async (key, value, options) => {
      data.set(key, value);
      sets.push({ key, value, ttl: options?.ttl });
    },
  };
  return { store, data, sets };
}

/** One upstream body, shaped exactly as the live API returns it. */
function body(domains: string[], asOf = '2026-09-01') {
  return {
    as_of: asOf,
    count: domains.length,
    results: domains.map((domain, i) => ({
      domain,
      found: true,
      open_page_rank: 5 + i,
      rank: 1000 + i,
      referring_domains: 42 + i,
      history: [{ date: '2026-09-01', open_page_rank: 5 + i, estimated: false }],
    })),
    invalid: [],
  };
}

function fetchReturning(payload: unknown) {
  // Typed with fetch's parameters so a test can assert on the request body that
  // was actually sent, which is how "only the uncached domains" is verified.
  return vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(payload), { status: 200 }),
  );
}

const env = { OPENPAGERANK_API_KEY: 'opr_live_test' };

describe('lookupAuthorityCached', () => {
  it('fetches on a cold cache and reports every domain as a miss', async () => {
    const { store, sets } = memoryStore();
    const fetchImpl = fetchReturning(body(['example.com']));

    const outcome = await lookupAuthorityCached(['example.com'], { store, fetchImpl, env });

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(outcome.hits).toBe(0);
    expect(outcome.misses).toBe(1);
    expect(outcome.report.results[0]!.openPageRank).toBe(5);
    expect(sets[0]!.ttl).toBe(DOMAIN_TTL_SECONDS);
  });

  it('serves a second identical lookup without touching upstream', async () => {
    const { store } = memoryStore();
    const first = fetchReturning(body(['example.com']));
    await lookupAuthorityCached(['example.com'], { store, fetchImpl: first, env });

    const second = fetchReturning(body(['example.com']));
    const outcome = await lookupAuthorityCached(['example.com'], { store, fetchImpl: second, env });

    expect(second).not.toHaveBeenCalled();
    expect(outcome.hits).toBe(1);
    expect(outcome.misses).toBe(0);
    expect(outcome.report.results[0]!.openPageRank).toBe(5);
  });

  /**
   * The behaviour the whole module exists for: a batch that is mostly cached must
   * spend quota only on what is genuinely new.
   */
  it('fetches only the uncached domains in a mixed batch', async () => {
    const { store } = memoryStore();
    await lookupAuthorityCached(['a.com', 'b.com'], {
      store,
      fetchImpl: fetchReturning(body(['a.com', 'b.com'])),
      env,
    });

    const fetchImpl = fetchReturning(body(['c.com']));
    const outcome = await lookupAuthorityCached(['a.com', 'b.com', 'c.com'], {
      store,
      fetchImpl,
      env,
    });

    const sentBody = JSON.parse(String(fetchImpl.mock.calls[0]![1]!.body));
    expect(sentBody.domains).toEqual(['c.com']);
    expect(outcome.hits).toBe(2);
    expect(outcome.misses).toBe(1);
  });

  it('normalizes before keying, so a URL and a bare domain are one cache entry', async () => {
    const { store } = memoryStore();
    await lookupAuthorityCached(['example.com'], {
      store,
      fetchImpl: fetchReturning(body(['example.com'])),
      env,
    });

    const fetchImpl = fetchReturning(body([]));
    const outcome = await lookupAuthorityCached(['https://WWW.Example.com/pricing?a=1'], {
      store,
      fetchImpl,
      env,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(outcome.hits).toBe(1);
  });

  it('keys history separately, so a no-history entry is never served as a series', async () => {
    const { store } = memoryStore();
    await lookupAuthorityCached(['example.com'], {
      store,
      fetchImpl: fetchReturning(body(['example.com'])),
      env,
      includeHistory: false,
    });

    const fetchImpl = fetchReturning(body(['example.com']));
    const outcome = await lookupAuthorityCached(['example.com'], {
      store,
      fetchImpl,
      env,
      includeHistory: true,
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(outcome.misses).toBe(1);
  });

  it('preserves the caller order, so a score is never attributed to another domain', async () => {
    const { store } = memoryStore();
    const outcome = await lookupAuthorityCached(['first.com', 'second.com'], {
      store,
      fetchImpl: fetchReturning(body(['second.com', 'first.com'])),
      env,
    });

    expect(outcome.report.results.map((r) => r.domain)).toEqual(['first.com', 'second.com']);
  });

  /* ── The cache must never be able to invent or corrupt an answer. ── */

  it('treats a corrupt cache entry as a miss rather than decoding it', async () => {
    const { store, data } = memoryStore();
    await lookupAuthorityCached(['example.com'], {
      store,
      fetchImpl: fetchReturning(body(['example.com'])),
      env,
    });

    const key = [...data.keys()].find((k) => k.includes('example.com'))!;
    data.set(key, { asOf: '2026-09-01', result: { domain: 'example.com', found: 'yes' } });

    const fetchImpl = fetchReturning(body(['example.com']));
    const outcome = await lookupAuthorityCached(['example.com'], { store, fetchImpl, env });

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(outcome.misses).toBe(1);
  });

  it('falls back to a live lookup when the cache itself throws', async () => {
    const store: AuthorityCacheStore = {
      get: async () => {
        throw new Error('cache down');
      },
      set: async () => {
        throw new Error('cache down');
      },
    };
    const fetchImpl = fetchReturning(body(['example.com']));

    const outcome = await lookupAuthorityCached(['example.com'], { store, fetchImpl, env });

    expect(outcome.report.results[0]!.openPageRank).toBe(5);
  });

  it('still rejects input with no usable domain', async () => {
    const { store } = memoryStore();
    await expect(
      lookupAuthorityCached(['not a domain'], { store, fetchImpl: fetchReturning({}), env }),
    ).rejects.toBeInstanceOf(AuthorityError);
  });

  it('propagates an upstream failure instead of serving a partial report', async () => {
    const { store } = memoryStore();
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 429 }));

    await expect(
      lookupAuthorityCached(['example.com'], { store, fetchImpl, env }),
    ).rejects.toMatchObject({ code: 'upstream_rejected' });
  });
});
