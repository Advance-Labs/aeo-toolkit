import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoogleOAuthTokens, TokenStore } from '@aeo/types';
import type { GoogleOAuth } from '@aeo/google-api';

// Mock the storage adapter so the env-gated factory test never builds a real Supabase
// client or touches the network. `vi.hoisted` keeps the spy refs available inside the
// hoisted `vi.mock` factory.
const { createSupabaseClientMock, supabaseTokenStoreCtor } = vi.hoisted(() => ({
  createSupabaseClientMock: vi.fn((_config: unknown) => ({ __fakeClient: true })),
  supabaseTokenStoreCtor: vi.fn(),
}));
vi.mock('@aeo/storage', () => ({
  createSupabaseClient: (config: unknown) => createSupabaseClientMock(config),
  SupabaseTokenStore: class {
    constructor(client: unknown, opts: unknown) {
      supabaseTokenStoreCtor(client, opts);
    }
  },
}));

import { createTokenStore, TokenResolver } from './auth.js';
import { InMemoryTokenStore } from '@aeo/google-api';

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

describe('createTokenStore (env-gated)', () => {
  beforeEach(() => {
    createSupabaseClientMock.mockClear();
    supabaseTokenStoreCtor.mockClear();
  });

  it('falls back to the in-memory store when no Supabase config is present', () => {
    const store = createTokenStore(null);
    expect(store).toBeInstanceOf(InMemoryTokenStore);
    expect(createSupabaseClientMock).not.toHaveBeenCalled();
    expect(supabaseTokenStoreCtor).not.toHaveBeenCalled();
  });

  it('builds a Supabase-backed store when config is present (no encryption key)', () => {
    createTokenStore({
      url: 'https://x.supabase.co',
      serviceRoleKey: 'srk',
      encryptionKey: null,
    });
    expect(createSupabaseClientMock).toHaveBeenCalledWith({
      url: 'https://x.supabase.co',
      serviceKey: 'srk',
    });
    expect(supabaseTokenStoreCtor).toHaveBeenCalledTimes(1);
    const opts = supabaseTokenStoreCtor.mock.calls[0]?.[1];
    expect(opts).toEqual({});
  });

  it('passes the encryption key through for at-rest encryption when configured', () => {
    createTokenStore({
      url: 'https://x.supabase.co',
      serviceRoleKey: 'srk',
      encryptionKey: 'passphrase',
    });
    const opts = supabaseTokenStoreCtor.mock.calls[0]?.[1];
    expect(opts).toEqual({ encryptionKey: 'passphrase' });
  });
});
