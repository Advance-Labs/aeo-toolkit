/**
 * Supabase-backed implementation of the shared {@link TokenStore} contract.
 *
 * Rows live in a table (default `oauth_tokens`) keyed by `user_id`, with columns:
 *   user_id, access_token, refresh_token, expires_at, scope.
 * `expires_at` is stored as Unix milliseconds (an integer column).
 *
 * When an `encryptionKey` is supplied, `access_token` and `refresh_token` are encrypted at rest
 * with AES-256-GCM (see `./crypto.js`) and transparently decrypted on read. Without it, tokens are
 * stored verbatim (suitable only for trusted/dev environments).
 *
 * The Supabase SDK is reached only through the small structural {@link SupabaseLike} seam, so tests
 * inject a fake with the same chainable shape and never touch the network.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { GoogleOAuthTokens, TokenStore } from '@aeo/types';
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
}

const DEFAULT_TABLE = 'oauth_tokens';
const USER_ID_COLUMN = 'user_id';

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
    // The real SupabaseClient's query builder is a structural superset of the narrow seam we use;
    // narrowing it here (once) keeps the call sites and the rest of this class fully typed.
    this.#client = client as SupabaseLike;
    this.#table = opts.table ?? DEFAULT_TABLE;
    this.#encryptionKey = opts.encryptionKey;
  }

  async get(userId: string): Promise<GoogleOAuthTokens | null> {
    const { data, error } = await this.#client
      .from(this.#table)
      .select('user_id, access_token, refresh_token, expires_at, scope')
      .eq(USER_ID_COLUMN, userId)
      .maybeSingle();

    if (error) {
      throw new TokenStoreError(`failed to load tokens for user: ${error.message}`);
    }
    if (data === null) {
      return null;
    }
    return this.#rowToTokens(data);
  }

  async set(userId: string, tokens: GoogleOAuthTokens): Promise<void> {
    const row = this.#tokensToRow(userId, tokens);
    const { error } = await this.#client
      .from(this.#table)
      .upsert(row, { onConflict: USER_ID_COLUMN });

    if (error) {
      throw new TokenStoreError(`failed to persist tokens for user: ${error.message}`);
    }
  }

  async delete(userId: string): Promise<void> {
    const { error } = await this.#client.from(this.#table).delete().eq(USER_ID_COLUMN, userId);

    if (error) {
      throw new TokenStoreError(`failed to delete tokens for user: ${error.message}`);
    }
  }

  #tokensToRow(userId: string, tokens: GoogleOAuthTokens): TokenRow {
    const refresh = tokens.refreshToken;
    return {
      user_id: userId,
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
