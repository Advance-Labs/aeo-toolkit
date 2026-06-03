/**
 * Google OAuth helper factory + session-cookie utilities.
 *
 * `GoogleOAuth` from `@aeo/google-api` is pure config — we build it per request from the server
 * environment. The signed-in user is identified by an opaque id stored in an httpOnly cookie; the
 * OAuth `state` parameter carries a CSRF nonce that the callback verifies.
 */
import { GoogleOAuth } from '@aeo/google-api';
import type { GoogleOAuthTokens } from '@aeo/types';
import { googleEnv } from './env.js';
import { getTokenStore } from './token-store.js';

export const USER_COOKIE = 'aeo_uid';
export const STATE_COOKIE = 'aeo_oauth_state';

/** Build a `GoogleOAuth` client from the server environment (read-only GA4 + GSC scopes). */
export function createOAuth(): GoogleOAuth {
  const env = googleEnv();
  return new GoogleOAuth({
    clientId: env.clientId,
    clientSecret: env.clientSecret,
    redirectUri: env.redirectUri,
    // scopes default to read-only GA4 + GSC in the client.
  });
}

/** Generate an opaque, URL-safe random id (user id or CSRF state nonce). */
export function randomId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

/**
 * Resolve a fresh, valid access token for a user, refreshing via the stored refresh token when the
 * cached access token has expired (or is about to within the skew window). Returns `null` when the
 * user has no stored tokens (i.e. is not connected).
 *
 * The refreshed token is written back to the store so subsequent requests reuse it until expiry.
 */
export async function getValidAccessToken(
  userId: string,
  nowMs: number = Date.now(),
  skewMs = 60_000,
): Promise<string | null> {
  const store = getTokenStore();
  const tokens = await store.get(userId);
  if (tokens === null) return null;

  if (tokens.expiresAt - skewMs > nowMs) {
    return tokens.accessToken;
  }

  if (tokens.refreshToken === undefined) {
    // Access token expired and we cannot refresh — treat as disconnected.
    return null;
  }

  const oauth = createOAuth();
  const refreshed: GoogleOAuthTokens = await oauth.refresh(tokens.refreshToken);
  await store.set(userId, refreshed);
  return refreshed.accessToken;
}
