import type { GoogleOAuthTokens } from '@aeo/types';
import { describe, expect, it } from 'vitest';
import { decrypt } from './crypto.js';
import { SupabaseTokenStore, TokenStoreError } from './token-store.js';
import type { SupabaseLike, TokenRow } from './token-store.js';

/** Records of the mutations the fake observed, so tests can assert what was written. */
interface FakeState {
  selectFilters: Array<{ column: string; value: string }>;
  upserted: Array<{ row: TokenRow; onConflict: string }>;
  deleted: Array<{ column: string; value: string }>;
}

interface FakeOptions {
  /** Row returned by `.maybeSingle()`. `null` means "no row". */
  selectRow?: TokenRow | null;
  /** Error returned by the terminal builder for the matching op. */
  error?: { message: string } | null;
}

interface PostgrestResult<T> {
  data: T;
  error: { message: string } | null;
}

/**
 * Build an awaitable PostgREST-style builder: a real Promise (so `then` conformance is automatic)
 * with chainable methods attached. The store either awaits it directly or calls `.maybeSingle()`.
 */
type Thenable<T> = PromiseLike<PostgrestResult<T>> & Record<string, (...args: string[]) => unknown>;

function thenable<T>(
  result: PostgrestResult<T>,
  methods: Record<string, (...args: string[]) => unknown>,
): Thenable<T> {
  const promise = Promise.resolve(result) as unknown as Thenable<T>;
  return Object.assign(promise, methods);
}

/**
 * A hand-rolled Supabase stand-in implementing only the chain the store uses:
 *   from().select().eq().maybeSingle()
 *   from().upsert(row, { onConflict })
 *   from().delete().eq()
 * No network, no SDK. Typed `unknown` then narrowed to `SupabaseLike` at the boundary — the only
 * cast in this test, localized to the mock.
 */
function makeFakeClient(opts: FakeOptions = {}): { client: SupabaseLike; state: FakeState } {
  const state: FakeState = { selectFilters: [], upserted: [], deleted: [] };
  const error = opts.error ?? null;
  const selectRow: TokenRow | null = opts.selectRow ?? null;

  const fake = {
    from() {
      return {
        select() {
          const builder: Thenable<TokenRow | null> = thenable<TokenRow | null>(
            { data: selectRow, error },
            {
              eq(column: string, value: string) {
                state.selectFilters.push({ column, value });
                return builder;
              },
              maybeSingle() {
                return Promise.resolve({ data: selectRow, error });
              },
            },
          );
          return builder;
        },
        upsert(row: TokenRow, options: { onConflict: string }) {
          state.upserted.push({ row, onConflict: options.onConflict });
          return thenable<null>({ data: null, error }, {});
        },
        delete() {
          const builder: Thenable<null> = thenable<null>(
            { data: null, error },
            {
              eq(column: string, value: string) {
                state.deleted.push({ column, value });
                return builder;
              },
            },
          );
          return builder;
        },
      };
    },
  };

  return { client: fake as unknown as SupabaseLike, state };
}

const SAMPLE_TOKENS: GoogleOAuthTokens = {
  accessToken: 'access-abc',
  refreshToken: 'refresh-xyz',
  expiresAt: 1_900_000_000_000,
  scope: 'https://www.googleapis.com/auth/webmasters.readonly',
};

describe('SupabaseTokenStore (unencrypted)', () => {
  it('maps a row to GoogleOAuthTokens on get and filters by user_id', async () => {
    const row: TokenRow = {
      user_id: 'user-1',
      access_token: 'access-abc',
      refresh_token: 'refresh-xyz',
      expires_at: 1_900_000_000_000,
      scope: 'scope-a',
    };
    const { client, state } = makeFakeClient({ selectRow: row });
    const store = new SupabaseTokenStore(client);

    const tokens = await store.get('user-1');

    expect(tokens).toEqual({
      accessToken: 'access-abc',
      refreshToken: 'refresh-xyz',
      expiresAt: 1_900_000_000_000,
      scope: 'scope-a',
    });
    expect(state.selectFilters).toEqual([{ column: 'user_id', value: 'user-1' }]);
  });

  it('returns null when no row exists', async () => {
    const { client } = makeFakeClient({ selectRow: null });
    const store = new SupabaseTokenStore(client);
    expect(await store.get('missing')).toBeNull();
  });

  it('upserts mapped columns on set, keyed on user_id', async () => {
    const { client, state } = makeFakeClient();
    const store = new SupabaseTokenStore(client, { table: 'custom_tokens' });

    await store.set('user-1', SAMPLE_TOKENS);

    expect(state.upserted).toHaveLength(1);
    const written = state.upserted[0];
    expect(written?.onConflict).toBe('user_id');
    expect(written?.row).toEqual({
      user_id: 'user-1',
      access_token: 'access-abc',
      refresh_token: 'refresh-xyz',
      expires_at: 1_900_000_000_000,
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    });
  });

  it('stores a null refresh_token when none is provided', async () => {
    const { client, state } = makeFakeClient();
    const store = new SupabaseTokenStore(client);

    await store.set('user-2', {
      accessToken: 'a',
      expiresAt: 123,
      scope: 's',
    });

    expect(state.upserted[0]?.row.refresh_token).toBeNull();
  });

  it('omits refreshToken on read when the column is null', async () => {
    const row: TokenRow = {
      user_id: 'u',
      access_token: 'a',
      refresh_token: null,
      expires_at: 123,
      scope: 's',
    };
    const { client } = makeFakeClient({ selectRow: row });
    const store = new SupabaseTokenStore(client);

    const tokens = await store.get('u');
    expect(tokens).toEqual({ accessToken: 'a', expiresAt: 123, scope: 's' });
    expect(tokens && 'refreshToken' in tokens).toBe(false);
  });

  it('deletes by user_id', async () => {
    const { client, state } = makeFakeClient();
    const store = new SupabaseTokenStore(client);

    await store.delete('user-1');
    expect(state.deleted).toEqual([{ column: 'user_id', value: 'user-1' }]);
  });

  it('throws TokenStoreError when the database reports an error', async () => {
    const { client } = makeFakeClient({ error: { message: 'boom' } });
    const store = new SupabaseTokenStore(client);

    await expect(store.get('user-1')).rejects.toBeInstanceOf(TokenStoreError);
    await expect(store.set('user-1', SAMPLE_TOKENS)).rejects.toBeInstanceOf(TokenStoreError);
    await expect(store.delete('user-1')).rejects.toBeInstanceOf(TokenStoreError);
  });
});

describe('SupabaseTokenStore (encrypted)', () => {
  const ENCRYPTION_KEY = 'a-strong-passphrase-for-tests';

  it('encrypts tokens at rest and decrypts them on read (round-trip)', async () => {
    const { client, state } = makeFakeClient();
    const store = new SupabaseTokenStore(client, { encryptionKey: ENCRYPTION_KEY });

    await store.set('user-1', SAMPLE_TOKENS);
    const written = state.upserted[0]?.row;
    expect(written).toBeDefined();
    if (!written) throw new Error('expected a written row');

    // Ciphertext must differ from the plaintext token values.
    expect(written.access_token).not.toBe(SAMPLE_TOKENS.accessToken);
    expect(written.refresh_token).not.toBe(SAMPLE_TOKENS.refreshToken);
    expect(written.access_token).not.toContain(SAMPLE_TOKENS.accessToken);

    // The stored ciphertext decrypts back to the original plaintext.
    expect(decrypt(written.access_token, ENCRYPTION_KEY)).toBe(SAMPLE_TOKENS.accessToken);
    expect(written.refresh_token).not.toBeNull();
    if (written.refresh_token) {
      expect(decrypt(written.refresh_token, ENCRYPTION_KEY)).toBe(SAMPLE_TOKENS.refreshToken);
    }

    // Non-secret columns are stored verbatim.
    expect(written.expires_at).toBe(SAMPLE_TOKENS.expiresAt);
    expect(written.scope).toBe(SAMPLE_TOKENS.scope);

    // Reading that ciphertext back yields the original tokens.
    const { client: readClient } = makeFakeClient({ selectRow: written });
    const readStore = new SupabaseTokenStore(readClient, { encryptionKey: ENCRYPTION_KEY });
    expect(await readStore.get('user-1')).toEqual(SAMPLE_TOKENS);
  });
});
