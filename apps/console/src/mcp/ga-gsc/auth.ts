/**
 * Access-token resolution for the GA4 + GSC MCP tools.
 *
 * Tools never touch the OAuth machinery directly: they ask a {@link TokenResolver}
 * for a fresh Google access token for the current user. The resolver:
 *   1. reads stored tokens from a {@link TokenStore} (InMemory by default),
 *   2. transparently refreshes an expired access token via {@link GoogleOAuth},
 *   3. falls back to a static dev token when no store entry exists.
 *
 * BYOK / request-scoped tokens: a per-request bearer token (from the MCP HTTP
 * `Authorization` header) is passed in and takes precedence — it is never written
 * back to the store and never logged.
 */
import { GoogleOAuth, InMemoryTokenStore } from '@aeo/google-api';
import type { GoogleOAuthTokens, TokenStore } from '@aeo/types';
import { McpToolError } from '@aeo/mcp-core';
import { createSupabaseClient, SupabaseTokenStore } from '@aeo/storage';
import type { GoogleOAuthEnv, SupabaseEnv } from './config.js';

/** Skew applied to the expiry check so we refresh slightly before the hard expiry. */
const EXPIRY_SKEW_MS = 60_000;

/** The default identity used when the transport carries no per-user session. */
export const DEFAULT_USER_ID = 'default';

export interface TokenResolverOptions {
  store: TokenStore;
  /** OAuth client used to refresh expired access tokens; `null` disables refresh. */
  oauth: GoogleOAuth | null;
  /** Static access token for single-user local dev (used when the store is empty). */
  staticAccessToken?: string | null;
  /** Injectable clock (ms) for deterministic expiry tests. */
  now?: () => number;
}

/**
 * Resolves a usable Google access token for a user, refreshing as needed.
 *
 * Pure orchestration over the injected store + OAuth client — no global state, so
 * it is fully unit-testable with a fake store and a stubbed OAuth refresh.
 */
export class TokenResolver {
  private readonly store: TokenStore;
  private readonly oauth: GoogleOAuth | null;
  private readonly staticAccessToken: string | null;
  private readonly now: () => number;

  constructor(opts: TokenResolverOptions) {
    this.store = opts.store;
    this.oauth = opts.oauth;
    this.staticAccessToken = opts.staticAccessToken ?? null;
    this.now = opts.now ?? (() => Date.now());
  }

  /**
   * Resolve an access token for `userId`.
   *
   * @param requestToken a request-scoped BYOK bearer token; when present it wins
   *   and is returned verbatim (never persisted, never logged).
   */
  async resolveAccessToken(
    userId: string = DEFAULT_USER_ID,
    requestToken?: string | null,
  ): Promise<string> {
    if (requestToken && requestToken.length > 0) {
      return requestToken;
    }

    const stored = await this.store.get(userId);
    if (stored) {
      if (!this.isExpired(stored)) {
        return stored.accessToken;
      }
      const refreshed = await this.tryRefresh(userId, stored);
      if (refreshed) {
        return refreshed.accessToken;
      }
      // Expired with no refresh path: surface the stale token rather than guessing —
      // the live Google call will return a typed 401 the tool reports cleanly.
      return stored.accessToken;
    }

    if (this.staticAccessToken) {
      return this.staticAccessToken;
    }

    throw new McpToolError(
      `No Google credentials for user "${userId}". Connect your Google account (OAuth) ` +
        `or set GOOGLE_ACCESS_TOKEN for local dev.`,
      'no_credentials',
    );
  }

  private isExpired(tokens: GoogleOAuthTokens): boolean {
    return tokens.expiresAt - EXPIRY_SKEW_MS <= this.now();
  }

  /** Refresh + persist when a refresh token and OAuth client are available. */
  private async tryRefresh(
    userId: string,
    tokens: GoogleOAuthTokens,
  ): Promise<GoogleOAuthTokens | null> {
    if (!this.oauth || tokens.refreshToken === undefined) {
      return null;
    }
    const refreshed = await this.oauth.refresh(tokens.refreshToken);
    await this.store.set(userId, refreshed);
    return refreshed;
  }
}

/**
 * Env-gated {@link TokenStore} factory.
 *
 * Returns the durable, optionally-encrypted Supabase-backed store from `@aeo/storage`
 * when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are configured (the only path that
 * survives stateless serverless across instances); otherwise falls back to the
 * process-local {@link InMemoryTokenStore} so local dev and tests run without secrets.
 *
 * When `TOKEN_ENCRYPTION_KEY` is present the Supabase store encrypts the access/refresh
 * tokens at rest (AES-256-GCM). The service-role key is read only here and is never
 * logged.
 */
export function createTokenStore(supabase: SupabaseEnv | null): TokenStore {
  if (supabase === null) {
    return new InMemoryTokenStore();
  }
  const client = createSupabaseClient({
    url: supabase.url,
    serviceKey: supabase.serviceRoleKey,
  });
  return new SupabaseTokenStore(client, {
    ...(supabase.encryptionKey !== null ? { encryptionKey: supabase.encryptionKey } : {}),
  });
}

/**
 * Build the default {@link TokenResolver} wiring from server config.
 *
 * Uses the {@link createTokenStore} env-gated store (Supabase in prod, in-memory in
 * dev) unless an explicit `store` is supplied. The OAuth client is constructed only
 * when full credentials are present.
 */
export function createDefaultTokenResolver(opts: {
  oauthEnv: GoogleOAuthEnv | null;
  staticAccessToken: string | null;
  supabase?: SupabaseEnv | null;
  store?: TokenStore;
}): TokenResolver {
  const store = opts.store ?? createTokenStore(opts.supabase ?? null);
  const oauth =
    opts.oauthEnv !== null
      ? new GoogleOAuth({
          clientId: opts.oauthEnv.clientId,
          clientSecret: opts.oauthEnv.clientSecret,
          redirectUri: opts.oauthEnv.redirectUri,
        })
      : null;
  return new TokenResolver({ store, oauth, staticAccessToken: opts.staticAccessToken });
}
