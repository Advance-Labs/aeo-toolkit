/**
 * OAuth authorization-code callback handling.
 *
 * The hosted flow: Claude.ai discovers the auth server via `.well-known`, the user
 * consents at Google, Google redirects to `GOOGLE_REDIRECT_URI?code=...&state=...`,
 * and this module exchanges the code for tokens and writes them to the
 * {@link TokenStore} that {@link TokenResolver} later reads.
 *
 * The exchange itself is real (`@aeo/google-api` `GoogleOAuth.exchangeCode`); the
 * binding of `state` → a durable user identity is now an HMAC-signed token (see
 * {@link signState} / {@link verifyState} in `./state.ts`) so a forged `state` cannot
 * write tokens under another user's identity.
 */
import { GoogleOAuth } from '@aeo/google-api';
import type { TokenStore } from '@aeo/types';
import type { GoogleOAuthEnv } from './config.js';
import { signState, verifyState } from './state.js';

export interface OAuthCallbackDeps {
  oauthEnv: GoogleOAuthEnv;
  store: TokenStore;
  /** Allows injecting a fake GoogleOAuth in tests. */
  oauthFactory?: (env: GoogleOAuthEnv) => Pick<GoogleOAuth, 'exchangeCode' | 'getAuthUrl'>;
}

export interface OAuthCallbackResult {
  userId: string;
  scope: string;
  hasRefreshToken: boolean;
}

function buildOAuth(deps: OAuthCallbackDeps): Pick<GoogleOAuth, 'exchangeCode' | 'getAuthUrl'> {
  if (deps.oauthFactory) return deps.oauthFactory(deps.oauthEnv);
  return new GoogleOAuth({
    clientId: deps.oauthEnv.clientId,
    clientSecret: deps.oauthEnv.clientSecret,
    redirectUri: deps.oauthEnv.redirectUri,
  });
}

/**
 * Build the Google consent URL to start the connect flow.
 *
 * The `state` parameter is an HMAC-signed token binding `userId` to the issue time
 * ({@link signState}); the callback re-verifies it before trusting the identity, so a
 * forged or tampered `state` cannot redirect another user's tokens into the wrong row.
 *
 * @param userId the verified identity of the user initiating the connect flow.
 * @param now    injectable clock (ms) for deterministic tests.
 */
export function buildAuthUrl(deps: OAuthCallbackDeps, userId: string, now?: number): string {
  const state = signState(userId, now);
  return buildOAuth(deps).getAuthUrl(state);
}

/**
 * Exchange the authorization `code` and persist the resulting tokens.
 *
 * The user identity is derived by verifying the signed `state` ({@link verifyState}),
 * which throws if the value was tampered with or has expired. We verify the state
 * *before* exchanging the code so a forged callback never reaches Google's token
 * endpoint with our client credentials.
 *
 * @param code  the `code` query param Google redirected with.
 * @param state the signed `state` query param; verified to derive the user id.
 * @param now   injectable clock (ms) for deterministic tests.
 */
export async function handleOAuthCallback(
  deps: OAuthCallbackDeps,
  code: string,
  state: string,
  now?: number,
): Promise<OAuthCallbackResult> {
  if (code.length === 0) {
    throw new Error('OAuth callback missing authorization code.');
  }

  // Verify the signed state first — this throws InvalidStateError on tamper/expiry,
  // so we never spend a code exchange on an unverified identity.
  const userId = verifyState(state, now);

  const oauth = buildOAuth(deps);
  const tokens = await oauth.exchangeCode(code);

  await deps.store.set(userId, tokens);
  return {
    userId,
    scope: tokens.scope,
    hasRefreshToken: tokens.refreshToken !== undefined,
  };
}
