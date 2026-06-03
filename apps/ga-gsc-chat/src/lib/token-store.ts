/**
 * Token-store seam for the app.
 *
 * The OAuth callback persists Google refresh tokens here and `/api/chat` reads them back to mint a
 * fresh access token per request. For local/dev we use the process-wide {@link InMemoryTokenStore}
 * from `@aeo/google-api`; a durable, encrypted adapter (Supabase) is the production wiring point.
 *
 * The store is module-scoped so it survives across requests within a single server process. In a
 * serverless / multi-instance deployment this is NOT durable — that is exactly why the Supabase
 * adapter below is the real production seam.
 */
import { InMemoryTokenStore } from '@aeo/google-api';
import type { GoogleOAuthTokens, TokenStore } from '@aeo/types';

// Single in-memory store shared across route handlers in this process (dev / single instance only).
const memoryStore = new InMemoryTokenStore();

/**
 * Return the active {@link TokenStore}. Swap the implementation here to go durable without touching
 * call sites.
 */
export function getTokenStore(): TokenStore {
  // STUB: production should return a SupabaseTokenStore (encrypted at rest, multi-instance safe).
  // The seam is the `TokenStore` interface from `@aeo/types`; see {@link SupabaseTokenStore} below.
  return memoryStore;
}

/**
 * STUB: durable, encrypted token storage backed by Supabase.
 *
 * Implements the same {@link TokenStore} contract as the in-memory store. Left unwired so the app
 * compiles and runs without Supabase credentials; the method bodies mark exactly where the real
 * `@supabase/supabase-js` calls go. Refresh tokens MUST be encrypted at rest (e.g. pgsodium /
 * Vault) and scoped per user.
 */
export class SupabaseTokenStore implements TokenStore {
  // STUB: constructor would accept a Supabase client + table name.
  constructor(private readonly _table: string = 'google_oauth_tokens') {}

  async get(_userId: string): Promise<GoogleOAuthTokens | null> {
    // STUB: SELECT encrypted token row by userId, decrypt, map to GoogleOAuthTokens.
    throw new Error('SupabaseTokenStore.get is not implemented (STUB).');
  }

  async set(_userId: string, _tokens: GoogleOAuthTokens): Promise<void> {
    // STUB: UPSERT encrypted token row keyed by userId.
    throw new Error('SupabaseTokenStore.set is not implemented (STUB).');
  }

  async delete(_userId: string): Promise<void> {
    // STUB: DELETE token row by userId (disconnect).
    throw new Error('SupabaseTokenStore.delete is not implemented (STUB).');
  }
}
