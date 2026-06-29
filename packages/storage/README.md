# @aeo/storage

Production storage and rate-limit adapters shared by the toolkit's MCP servers and web apps. It
provides a Supabase-backed OAuth token store (implementing the shared `@aeo/types` `TokenStore`
contract, with optional AES-256-GCM encryption at rest) and two rate limiters — an in-process
fixed-window fallback and an Upstash Redis sliding-window adapter — behind a single
`resolveRateLimiter` chooser. Every external SDK call (Supabase, Upstash) is isolated behind a small
injectable seam or a lazily constructed client, so consumers can mock I/O and the unit tests run
fully offline. Secrets (service keys, Redis tokens, encryption passphrases) come from the
constructor/env and are never hard-coded or logged.

## Usage

```ts
import {
  createSupabaseClient,
  SupabaseTokenStore,
  resolveRateLimiter,
} from '@aeo/storage';

// Encrypted, Supabase-backed token store.
const supabase = createSupabaseClient({
  url: process.env.SUPABASE_URL!,
  serviceKey: process.env.SUPABASE_SERVICE_KEY!,
});
const tokens = new SupabaseTokenStore(supabase, {
  table: 'oauth_tokens', // default
  encryptionKey: process.env.TOKEN_ENCRYPTION_KEY, // omit to store plaintext (dev only)
});

// Provider defaults to 'google', so existing single-provider callers are unchanged.
await tokens.set('user-123', {
  accessToken: 'ya29...',
  refreshToken: '1//0g...',
  expiresAt: Date.now() + 3_600_000,
  scope: 'https://www.googleapis.com/auth/webmasters.readonly',
});
const loaded = await tokens.get('user-123'); // GoogleOAuthTokens | null
await tokens.delete('user-123');

// Rows are keyed by (user_id, provider): one user can hold independent tokens per provider.
await tokens.set('user-123', redditTokens, 'reddit');
const reddit = await tokens.get('user-123', 'reddit');

// Managed (done-for-you) tier: no plaintext fallback — omitting encryptionKey throws (§H4).
import { createManagedTokenStore } from '@aeo/storage';
const managed = createManagedTokenStore(supabase, {
  encryptionKey: process.env.TOKEN_ENCRYPTION_KEY!, // required; throws if missing
});

// Rate limiting: Upstash in prod, in-memory fallback when Redis creds are absent.
const limiter = resolveRateLimiter({
  limit: 60,
  windowSeconds: 60,
  redisUrl: process.env.UPSTASH_REDIS_REST_URL,
  redisToken: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const { allowed, remaining, resetSeconds } = await limiter.check('user-123');
if (!allowed) {
  // 429: retry after `resetSeconds`.
}
```

## Public API

| Export | Kind | Description |
| --- | --- | --- |
| `createSupabaseClient(config)` | `SupabaseClient` | Thin wrapper over `@supabase/supabase-js` `createClient` with `auth.persistSession = false`. |
| `SupabaseTokenStore` | class (`implements TokenStore`) | `get`/`set`/`delete(userId, provider?)` against an `oauth_tokens`-shaped table keyed by `(user_id, provider)` (`provider` defaults to `'google'`); optional AES-256-GCM encryption of access/refresh tokens at rest. `requireEncryption: true` makes a missing `encryptionKey` throw. |
| `createManagedTokenStore(client, opts?)` | factory | Builds a `SupabaseTokenStore` with `requireEncryption` forced on — the managed-tier entry point (no plaintext fallback, §H4). |
| `TokenStoreError` | class | Thrown when a Supabase operation returns an error, or when `requireEncryption` is set without an `encryptionKey`. |
| `RateLimiter` | interface | `{ check(key): Promise<{ allowed, remaining, resetSeconds }> }`. |
| `InMemoryRateLimiter` | class | Real fixed-window limiter with an injectable clock; single-instance fallback. |
| `UpstashRateLimiter` | class | Sliding-window limiter over Upstash Redis (`@upstash/ratelimit` + `@upstash/redis`). |
| `resolveRateLimiter(opts)` | `RateLimiter` | Returns `UpstashRateLimiter` when `redisUrl` + `redisToken` are set, else `InMemoryRateLimiter`. |
| `encrypt` / `decrypt` / `deriveKey` | functions | AES-256-GCM helpers (scrypt-derived key, random IV, key-versioned `v1:<base64(iv\|authTag\|ciphertext)>`). `decrypt` tolerates the current version + legacy un-prefixed bodies, and rejects unknown versions. See `ROTATION.md`. |
| `CURRENT_KEY_VERSION` | const | The at-rest key/scheme version stamped onto fresh ciphertext (today `'v1'`). |
| `TokenCryptoError` | class | Thrown on malformed ciphertext or authentication failure. |
| `SupabaseLike`, `UpstashLimiterLike` | types | The injectable I/O seams that let tests substitute fakes. |

Domain shapes (`TokenStore`, `GoogleOAuthTokens`) are imported from `@aeo/types`; this package never
redefines them.

### Expected table schema (`oauth_tokens`)

| Column | Type | Notes |
| --- | --- | --- |
| `user_id` | text | part of the composite primary key |
| `provider` | text | `'google'` / `'reddit'` / `'cms'`; part of the composite primary key + conflict target |
| `access_token` | text | ciphertext when `encryptionKey` is set |
| `refresh_token` | text, nullable | ciphertext when `encryptionKey` is set |
| `expires_at` | bigint | Unix milliseconds |
| `scope` | text | OAuth scope string |

Primary key / `upsert` conflict target is the composite `(user_id, provider)`. Apply
`migrations/0001_oauth_tokens_provider.sql` to an existing single-key table (additive, back-fills
`provider = 'google'`).

## Status

**Implemented.** No stubs. The Supabase seam (`SupabaseLike`) and the Upstash limiter seam
(`UpstashLimiterLike`) keep the third-party SDKs out of the unit tests; the real clients are built
only on the production path (`createSupabaseClient`, `new UpstashRateLimiter(...)` without an injected
limiter). Encryption uses Node's built-in `node:crypto` (AES-256-GCM + scrypt). Tested: crypto
round-trip + tamper rejection, token-store mapping + encryption round-trip with a fake Supabase
client, rate-limiter window behavior with an injected clock, and `resolveRateLimiter` branch
selection.
