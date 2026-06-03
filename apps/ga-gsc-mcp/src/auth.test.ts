import { describe, expect, it, vi } from 'vitest';
import type { GoogleOAuthTokens, TokenStore } from '@aeo/types';
import type { GoogleOAuth } from '@aeo/google-api';

import { TokenResolver } from './auth.js';

/** Minimal in-memory store for tests (the package's InMemoryTokenStore is also fine). */
function makeStore(seed?: Record<string, GoogleOAuthTokens>): TokenStore {
  const map = new Map<string, GoogleOAuthTokens>(Object.entries(seed ?? {}));
  return {
    async get(id) {
      return map.get(id) ?? null;
    },
    async set(id, tokens) {
      map.set(id, tokens);
    },
    async delete(id) {
      map.delete(id);
    },
  };
}

const FIXED_NOW = 1_000_000;

describe('TokenResolver', () => {
  it('returns the request-scoped BYOK token verbatim and never reads the store', async () => {
    const store = makeStore();
    const getSpy = vi.spyOn(store, 'get');
    const resolver = new TokenResolver({ store, oauth: null });
    await expect(resolver.resolveAccessToken('u1', 'byok-token')).resolves.toBe('byok-token');
    expect(getSpy).not.toHaveBeenCalled();
  });

  it('returns a stored, non-expired access token', async () => {
    const store = makeStore({
      u1: { accessToken: 'live', expiresAt: FIXED_NOW + 5_000_000, scope: 's' },
    });
    const resolver = new TokenResolver({ store, oauth: null, now: () => FIXED_NOW });
    await expect(resolver.resolveAccessToken('u1')).resolves.toBe('live');
  });

  it('refreshes an expired token via OAuth and persists the result', async () => {
    const store = makeStore({
      u1: { accessToken: 'old', refreshToken: 'r1', expiresAt: FIXED_NOW - 1, scope: 's' },
    });
    const refresh = vi.fn(
      async (): Promise<GoogleOAuthTokens> => ({
        accessToken: 'fresh',
        refreshToken: 'r1',
        expiresAt: FIXED_NOW + 9_000_000,
        scope: 's',
      }),
    );
    const oauth = { refresh } as unknown as GoogleOAuth;
    const resolver = new TokenResolver({ store, oauth, now: () => FIXED_NOW });

    await expect(resolver.resolveAccessToken('u1')).resolves.toBe('fresh');
    expect(refresh).toHaveBeenCalledWith('r1');
    await expect(store.get('u1')).resolves.toMatchObject({ accessToken: 'fresh' });
  });

  it('falls back to the static dev token when the store is empty', async () => {
    const resolver = new TokenResolver({
      store: makeStore(),
      oauth: null,
      staticAccessToken: 'dev-token',
    });
    await expect(resolver.resolveAccessToken('u1')).resolves.toBe('dev-token');
  });

  it('throws a typed error when no credentials are available', async () => {
    const resolver = new TokenResolver({ store: makeStore(), oauth: null });
    await expect(resolver.resolveAccessToken('u1')).rejects.toThrow(/No Google credentials/);
  });

  it('returns the stale token when expired but no refresh path exists', async () => {
    const store = makeStore({
      u1: { accessToken: 'stale', expiresAt: FIXED_NOW - 1, scope: 's' },
    });
    const resolver = new TokenResolver({ store, oauth: null, now: () => FIXED_NOW });
    await expect(resolver.resolveAccessToken('u1')).resolves.toBe('stale');
  });
});
