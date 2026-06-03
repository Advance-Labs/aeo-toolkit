/**
 * Hosted-mode OAuth token persistence seam.
 *
 * In hosted mode (Claude.ai remote connector), the authorization server issues
 * tokens that must survive across stateless serverless invocations. That requires
 * a real datastore (Supabase, KV, etc.). We expose a typed interface so the
 * wiring point is explicit and the server compiles/runs without a live backend.
 *
 * Per the toolkit security policy, BYOK *LLM* keys are NEVER stored here — only
 * OAuth access/refresh tokens for the connector handshake.
 */

export interface StoredToken {
  /** Opaque access token presented as a bearer credential. */
  accessToken: string;
  /** Optional refresh token for silent renewal. */
  refreshToken?: string;
  /** Unix epoch seconds at which the access token expires. */
  expiresAt: number;
  /** OAuth client id this token was minted for. */
  clientId: string;
  /** Granted scopes. */
  scopes: string[];
}

export interface TokenStore {
  get(accessToken: string): Promise<StoredToken | null>;
  put(token: StoredToken): Promise<void>;
  delete(accessToken: string): Promise<void>;
}

/**
 * STUB: in-memory TokenStore. Survives only within a single process, so it is
 * suitable for local stdio mode and tests but NOT for stateless serverless
 * (each invocation gets a fresh map). Swap for a Supabase/KV adapter in hosted
 * mode — see README "Status".
 *
 * TODO(hosted): implement `SupabaseTokenStore implements TokenStore` and select
 * it via env in `http.ts`.
 */
export class InMemoryTokenStore implements TokenStore {
  private readonly tokens = new Map<string, StoredToken>();

  get(accessToken: string): Promise<StoredToken | null> {
    return Promise.resolve(this.tokens.get(accessToken) ?? null);
  }

  put(token: StoredToken): Promise<void> {
    this.tokens.set(token.accessToken, token);
    return Promise.resolve();
  }

  delete(accessToken: string): Promise<void> {
    this.tokens.delete(accessToken);
    return Promise.resolve();
  }
}
