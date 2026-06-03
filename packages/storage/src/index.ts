/**
 * @aeo/storage — production storage and rate-limit adapters shared across the toolkit's apps.
 *
 * Two seams:
 *  - A Supabase-backed {@link SupabaseTokenStore} (implements the shared `TokenStore` contract) with
 *    optional AES-256-GCM encryption of OAuth tokens at rest.
 *  - Rate limiters: an in-memory fixed-window fallback and an Upstash sliding-window adapter, with a
 *    `resolveRateLimiter` chooser that prefers Upstash when Redis credentials are configured.
 *
 * All external SDK access (Supabase, Upstash) is isolated behind small injectable seams / lazily
 * constructed clients so the unit tests stay fully offline.
 */

export { createSupabaseClient } from './supabase-client.js';
export type { SupabaseClientConfig } from './supabase-client.js';

export { SupabaseTokenStore, TokenStoreError } from './token-store.js';
export type {
  SupabaseLike,
  SupabaseClientLike,
  SupabaseTokenStoreOptions,
  TokenRow,
} from './token-store.js';

export { deriveKey, encrypt, decrypt, TokenCryptoError } from './crypto.js';

export { InMemoryRateLimiter, UpstashRateLimiter, resolveRateLimiter } from './rate-limit.js';
export type {
  RateLimiter,
  RateLimitResult,
  InMemoryRateLimiterOptions,
  UpstashRateLimiterOptions,
  UpstashLimiterLike,
  UpstashLimitResult,
  ResolveRateLimiterOptions,
} from './rate-limit.js';
