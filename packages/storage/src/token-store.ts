/**
 * Supabase-backed implementation of the shared {@link TokenStore} contract.
 *
 * Rows live in a table (default `oauth_tokens`) keyed by the composite **`(user_id, provider)`**,
 * with columns: `user_id, provider, access_token, refresh_token, expires_at, scope`. The composite
 * key lets one user hold independent tokens per {@link TokenProvider} (`google` / `reddit` / `cms`)
 * without collision (security §H4). `expires_at` is stored as Unix milliseconds (an integer column).
 *
 * `provider` defaults to `'google'` across the API, so the pre-H4 single-provider callers (and the
 * `TokenStore` interface, which is provider-unaware) keep working unchanged.
 *
 * When an `encryptionKey` is supplied, `access_token` and `refresh_token` are encrypted at rest
 * with AES-256-GCM (see `./crypto.js`) and transparently decrypted on read. The managed tier must
 * pass `requireEncryption: true` (or use {@link createManagedTokenStore}); constructing without a
 * key then throws rather than silently persisting plaintext (security §H4). Without either, tokens
 * are stored verbatim (suitable only for trusted/dev environments).
 *
 * The Supabase SDK is reached only through the small structural {@link SupabaseLike} seam, so tests
 * inject a fake with the same chainable shape and never touch the network.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { GoogleOAuthTokens, TokenProvider, TokenStore } from '@aeo/types';
import { decrypt, encrypt } from './crypto.js';

/** Shape of `{ data, error }` returned by terminal PostgREST builders. */
interface PostgrestResult<T> {
  data: T;
  error: { message: string } | null;
}

/** A PostgREST query builder is thenable (await-able) and chainable for the calls we use. */
interface SelectBuilder<Row> extends PromiseLike<PostgrestResult<Row | null>> {
  eq(column: string, value: string): SelectBuilder<Row>;
  maybeSingle(): PromiseLike<PostgrestResult<Row | null>>;
}

interface MutationBuilder extends PromiseLike<PostgrestResult<unknown>> {
  eq(column: string, value: string): MutationBuilder;
}

interface TableQuery<Row> {
  select(columns: string): SelectBuilder<Row>;
  upsert(values: Row, options: { onConflict: string }): MutationBuilder;
  delete(): MutationBuilder;
}

/**
 * The minimal structural surface of a Supabase client this store actually uses:
 * `from(table).select().eq().maybeSingle()`, `.upsert(row, { onConflict })`, `.delete().eq()`.
 *
 * The real `SupabaseClient` is accepted by the constructor; internally it is narrowed to this seam
 * (the real client's query builder is a structural superset). Test fakes implement exactly this
 * surface and are passed through the same constructor.
 */
export interface SupabaseLike {
  from(table: string): TableQuery<TokenRow>;
}

/** Either the real client or a structural stand-in (used by tests). */
export type SupabaseClientLike = SupabaseClient | SupabaseLike;

/** Raw database row layout. `null` is how PostgREST returns absent nullable columns. */
export interface TokenRow {
  user_id: string;
  provider: TokenProvider;
  access_token: string;
  refresh_token: string | null;
  expires_at: number;
  scope: string;
}

export interface SupabaseTokenStoreOptions {
  /** Table name. Defaults to `oauth_tokens`. */
  table?: string;
  /** Passphrase for AES-256-GCM at-rest encryption. Omit to store tokens unencrypted. */
  encryptionKey?: string;
  /**
   * When `true`, the constructor throws unless an `encryptionKey` is also supplied — i.e. there is
   * no plaintext fallback. Required for the managed tier (security §H4). Defaults to `false` so the
   * existing trusted/dev callers are unaffected.
   */
  requireEncryption?: boolean;
}

const DEFAULT_TABLE = 'oauth_tokens';
const USER_ID_COLUMN = 'user_id';
const PROVIDER_COLUMN = 'provider';
/** Conflict target for `upsert` — the composite primary key. */
const CONFLICT_TARGET = `${USER_ID_COLUMN},${PROVIDER_COLUMN}`;
/** Default provider, applied when a (legacy) caller omits it. */
const DEFAULT_PROVIDER: TokenProvider = 'google';
const SELECT_COLUMNS = 'user_id, provider, access_token, refresh_token, expires_at, scope';

/** Thrown when a Supabase operation returns an error. */
export class TokenStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenStoreError';
  }
}

export class SupabaseTokenStore implements TokenStore {
  readonly #client: SupabaseLike;
  readonly #table: string;
  readonly #encryptionKey: string | undefined;

  constructor(client: SupabaseClientLike, opts: SupabaseTokenStoreOptions = {}) {
    if (opts.requireEncryption === true && opts.encryptionKey === undefined) {
      throw new TokenStoreError(
        'requireEncryption is set but no encryptionKey was supplied: refusing to construct a ' +
          'token store that would persist tokens in plaintext (security §H4)',
      );
    }
    // The real SupabaseClient's query builder is a structural superset of the narrow seam we use;
    // narrowing it here (once) keeps the call sites and the rest of this class fully typed.
    this.#client = client as SupabaseLike;
    this.#table = opts.table ?? DEFAULT_TABLE;
    this.#encryptionKey = opts.encryptionKey;
  }

  async get(
    userId: string,
    provider: TokenProvider = DEFAULT_PROVIDER,
  ): Promise<GoogleOAuthTokens | null> {
    const { data, error } = await this.#client
      .from(this.#table)
      .select(SELECT_COLUMNS)
      .eq(USER_ID_COLUMN, userId)
      .eq(PROVIDER_COLUMN, provider)
      .maybeSingle();

    if (error) {
      throw new TokenStoreError(`failed to load tokens for user: ${error.message}`);
    }
    if (data === null) {
      return null;
    }
    return this.#rowToTokens(data);
  }

  async set(
    userId: string,
    tokens: GoogleOAuthTokens,
    provider: TokenProvider = DEFAULT_PROVIDER,
  ): Promise<void> {
    const row = this.#tokensToRow(userId, provider, tokens);
    const { error } = await this.#client
      .from(this.#table)
      .upsert(row, { onConflict: CONFLICT_TARGET });

    if (error) {
      throw new TokenStoreError(`failed to persist tokens for user: ${error.message}`);
    }
  }

  async delete(userId: string, provider: TokenProvider = DEFAULT_PROVIDER): Promise<void> {
    const { error } = await this.#client
      .from(this.#table)
      .delete()
      .eq(USER_ID_COLUMN, userId)
      .eq(PROVIDER_COLUMN, provider);

    if (error) {
      throw new TokenStoreError(`failed to delete tokens for user: ${error.message}`);
    }
  }

  #tokensToRow(userId: string, provider: TokenProvider, tokens: GoogleOAuthTokens): TokenRow {
    const refresh = tokens.refreshToken;
    return {
      user_id: userId,
      provider,
      access_token: this.#protect(tokens.accessToken),
      refresh_token: refresh === undefined ? null : this.#protect(refresh),
      expires_at: tokens.expiresAt,
      scope: tokens.scope,
    };
  }

  #rowToTokens(row: TokenRow): GoogleOAuthTokens {
    const base: GoogleOAuthTokens = {
      accessToken: this.#reveal(row.access_token),
      expiresAt: row.expires_at,
      scope: row.scope,
    };
    if (row.refresh_token !== null) {
      base.refreshToken = this.#reveal(row.refresh_token);
    }
    return base;
  }

  #protect(value: string): string {
    return this.#encryptionKey === undefined ? value : encrypt(value, this.#encryptionKey);
  }

  #reveal(value: string): string {
    return this.#encryptionKey === undefined ? value : decrypt(value, this.#encryptionKey);
  }
}

/** Options for {@link createManagedTokenStore} — same as the store, minus the forced flag. */
export type ManagedTokenStoreOptions = Omit<SupabaseTokenStoreOptions, 'requireEncryption'>;

/**
 * Managed-tier factory: builds a {@link SupabaseTokenStore} with `requireEncryption` forced on, so
 * omitting `encryptionKey` throws instead of silently persisting plaintext tokens (security §H4).
 * Prefer this over `new SupabaseTokenStore(...)` anywhere on the managed (done-for-you) path.
 */
export function createManagedTokenStore(
  client: SupabaseClientLike,
  opts: ManagedTokenStoreOptions = {},
): SupabaseTokenStore {
  return new SupabaseTokenStore(client, { ...opts, requireEncryption: true });
}
