/**
 * Tests for the env-gated token-store factory.
 *
 * All I/O is mocked: `@advance-labs/storage` (Supabase client + token store) and `@advance-labs/google-api`
 * (in-memory store) are stubbed so no network or real SDK runs. We assert that `getTokenStore()`
 * picks the Supabase adapter when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set, and the
 * in-memory store otherwise, and that the encryption key is threaded through only when present.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as TokenStoreModule from './token-store.js';

const createSupabaseClient = vi.fn(() => ({ __kind: 'supabase-client' }));

class FakeSupabaseTokenStore {
  static lastArgs: { client: unknown; opts: unknown } | undefined;
  readonly kind = 'supabase';
  constructor(client: unknown, opts: unknown) {
    FakeSupabaseTokenStore.lastArgs = { client, opts };
  }
  async get(): Promise<null> {
    return null;
  }
  async set(): Promise<void> {}
  async delete(): Promise<void> {}
}

class FakeInMemoryTokenStore {
  static instances = 0;
  readonly kind = 'memory';
  constructor() {
    FakeInMemoryTokenStore.instances += 1;
  }
  async get(): Promise<null> {
    return null;
  }
  async set(): Promise<void> {}
  async delete(): Promise<void> {}
}

vi.mock('@advance-labs/storage', () => ({
  createSupabaseClient,
  SupabaseTokenStore: FakeSupabaseTokenStore,
}));

vi.mock('@advance-labs/google-api', () => ({
  InMemoryTokenStore: FakeInMemoryTokenStore,
}));

const ENV_KEYS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'TOKEN_ENCRYPTION_KEY'] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  createSupabaseClient.mockClear();
  FakeSupabaseTokenStore.lastArgs = undefined;
  FakeInMemoryTokenStore.instances = 0;
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = saved[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  vi.resetModules();
});

async function loadFresh(): Promise<typeof TokenStoreModule> {
  vi.resetModules();
  return import('./token-store.js');
}

describe('getTokenStore', () => {
  it('falls back to the in-memory store when Supabase env vars are absent', async () => {
    const mod = await loadFresh();
    const store = mod.getTokenStore();

    expect((store as { kind?: string }).kind).toBe('memory');
    expect(createSupabaseClient).not.toHaveBeenCalled();
    expect(FakeInMemoryTokenStore.instances).toBe(1);
  });

  it('returns the in-memory store when only one Supabase var is set', async () => {
    process.env.SUPABASE_URL = 'https://proj.supabase.co';
    // SUPABASE_SERVICE_ROLE_KEY intentionally missing.

    const mod = await loadFresh();
    const store = mod.getTokenStore();

    expect((store as { kind?: string }).kind).toBe('memory');
    expect(createSupabaseClient).not.toHaveBeenCalled();
  });

  it('returns the Supabase store when url + service-role key are set', async () => {
    process.env.SUPABASE_URL = 'https://proj.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret';

    const mod = await loadFresh();
    const store = mod.getTokenStore();

    expect((store as { kind?: string }).kind).toBe('supabase');
    expect(createSupabaseClient).toHaveBeenCalledWith({
      url: 'https://proj.supabase.co',
      serviceKey: 'service-role-secret',
    });
    expect(FakeInMemoryTokenStore.instances).toBe(0);
    // No encryption key configured → undefined is threaded through.
    expect(FakeSupabaseTokenStore.lastArgs?.opts).toEqual({
      table: 'oauth_tokens',
      encryptionKey: undefined,
    });
  });

  it('threads the encryption key into the Supabase store when present', async () => {
    process.env.SUPABASE_URL = 'https://proj.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret';
    process.env.TOKEN_ENCRYPTION_KEY = 'a-strong-passphrase';

    const mod = await loadFresh();
    mod.getTokenStore();

    expect(FakeSupabaseTokenStore.lastArgs?.opts).toEqual({
      table: 'oauth_tokens',
      encryptionKey: 'a-strong-passphrase',
    });
  });

  it('caches the resolved store across calls (builds the client at most once)', async () => {
    process.env.SUPABASE_URL = 'https://proj.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret';

    const mod = await loadFresh();
    const first = mod.getTokenStore();
    const second = mod.getTokenStore();

    expect(first).toBe(second);
    expect(createSupabaseClient).toHaveBeenCalledTimes(1);
  });

  it('treats empty-string env vars as unset and falls back to in-memory', async () => {
    process.env.SUPABASE_URL = '';
    process.env.SUPABASE_SERVICE_ROLE_KEY = '';

    const mod = await loadFresh();
    const store = mod.getTokenStore();

    expect((store as { kind?: string }).kind).toBe('memory');
    expect(createSupabaseClient).not.toHaveBeenCalled();
  });

  it('re-resolves after __resetTokenStoreForTests when env changes', async () => {
    const mod = await loadFresh();
    expect((mod.getTokenStore() as { kind?: string }).kind).toBe('memory');

    process.env.SUPABASE_URL = 'https://proj.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret';
    mod.__resetTokenStoreForTests();

    expect((mod.getTokenStore() as { kind?: string }).kind).toBe('supabase');
  });
});
