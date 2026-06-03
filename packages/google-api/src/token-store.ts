/**
 * In-memory {@link TokenStore} implementation.
 *
 * Suitable for tests, local development, and single-process usage. Production should swap in an
 * encrypted, durable adapter (e.g. Supabase) that implements the same `TokenStore` interface from
 * `@aeo/types`. Tokens are cloned on read and write so external mutation cannot corrupt the store.
 */
import type { GoogleOAuthTokens, TokenStore } from '@aeo/types';

export class InMemoryTokenStore implements TokenStore {
  private readonly store = new Map<string, GoogleOAuthTokens>();

  async get(userId: string): Promise<GoogleOAuthTokens | null> {
    const tokens = this.store.get(userId);
    return tokens ? clone(tokens) : null;
  }

  async set(userId: string, tokens: GoogleOAuthTokens): Promise<void> {
    this.store.set(userId, clone(tokens));
  }

  async delete(userId: string): Promise<void> {
    this.store.delete(userId);
  }
}

function clone(tokens: GoogleOAuthTokens): GoogleOAuthTokens {
  const copy: GoogleOAuthTokens = {
    accessToken: tokens.accessToken,
    expiresAt: tokens.expiresAt,
    scope: tokens.scope,
  };
  if (tokens.refreshToken !== undefined) {
    copy.refreshToken = tokens.refreshToken;
  }
  return copy;
}
