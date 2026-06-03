/**
 * Token-store seam for the GA/GSC chat tool.
 *
 * The OAuth callback persists Google refresh tokens here and `/api/chat` reads them back to mint a
 * fresh access token per request. In production we use the durable, encrypted Supabase-backed
 * {@link SupabaseTokenStore} from `@aeo/storage`; for local/dev (no Supabase credentials) we fall
 * back to the process-wide {@link InMemoryTokenStore} from `@aeo/google-api`.
 *
 * Selection is env-gated: when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are both set, the
 * Supabase store is used (tokens encrypted at rest when `TOKEN_ENCRYPTION_KEY` is also present).
 * Otherwise the in-memory store keeps local dev and the test suite working with no secrets. The
 * in-memory store is module-scoped so it survives across requests within a single server process;
 * in a serverless / multi-instance deployment it is NOT durable — which is exactly why the Supabase
 * adapter is the production seam.
 */
import { InMemoryTokenStore } from '@aeo/google-api';
import { createSupabaseClient, SupabaseTokenStore } from '@aeo/storage';
import type { TokenStore } from '@aeo/types';

/**
 * Table holding the per-user OAuth token rows. Matches the `@aeo/storage` default schema
 * (`user_id`, `access_token`, `refresh_token`, `expires_at`, `scope`).
 */
const TOKEN_TABLE = 'oauth_tokens';

// Single in-memory store shared across route handlers in this process (dev / single instance only).
// Lazily created so importing this module never allocates when the Supabase path is used.
let memoryStore: InMemoryTokenStore | undefined;

function getMemoryStore(): InMemoryTokenStore {
  if (memoryStore === undefined) {
    memoryStore = new InMemoryTokenStore();
  }
  return memoryStore;
}

// Cache the resolved store so we build the Supabase client at most once per process.
let resolvedStore: TokenStore | undefined;

function nonEmptyEnv(name: string): string | undefined {
  const value = process.env[name];
  return value !== undefined && value.length > 0 ? value : undefined;
}

/**
 * Build the production Supabase-backed store when its credentials are configured, else `null` so the
 * caller can fall back to the in-memory store. Encryption at rest is enabled only when
 * `TOKEN_ENCRYPTION_KEY` is present; without it the store would persist plaintext tokens, which is
 * unacceptable in production, so we require the key alongside the connection credentials.
 */
function createSupabaseTokenStore(): TokenStore | null {
  const url = nonEmptyEnv('SUPABASE_URL');
  const serviceKey = nonEmptyEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (url === undefined || serviceKey === undefined) {
    return null;
  }

  const encryptionKey = nonEmptyEnv('TOKEN_ENCRYPTION_KEY');
  const client = createSupabaseClient({ url, serviceKey });
  return new SupabaseTokenStore(client, {
    table: TOKEN_TABLE,
    encryptionKey,
  });
}

/**
 * Return the active {@link TokenStore}. Picks the Supabase adapter when its env vars are present,
 * otherwise the in-memory dev store. The choice is cached for the lifetime of the process.
 */
export function getTokenStore(): TokenStore {
  if (resolvedStore === undefined) {
    resolvedStore = createSupabaseTokenStore() ?? getMemoryStore();
  }
  return resolvedStore;
}

/**
 * Reset the cached store selection. Test-only seam: lets a suite flip env vars and re-resolve the
 * store without leaking state between cases. Not used on the production request path.
 */
export function __resetTokenStoreForTests(): void {
  resolvedStore = undefined;
  memoryStore = undefined;
}
