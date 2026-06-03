/**
 * OAuth authorization-code callback handling.
 *
 * The hosted flow: Claude.ai discovers the auth server via `.well-known`, the user
 * consents at Google, Google redirects to `GOOGLE_REDIRECT_URI?code=...&state=...`,
 * and this module exchanges the code for tokens and writes them to the
 * {@link TokenStore} that {@link TokenResolver} later reads.
 *
 * The exchange itself is real (`@aeo/google-api` `GoogleOAuth.exchangeCode`); only
 * the binding of `state` → a durable user identity is a `// STUB:` (it needs a
 * signed session, which lives in the hosting layer / Supabase adapter).
 */
import { GoogleOAuth } from '@aeo/google-api';
import type { TokenStore } from '@aeo/types';
import type { GoogleOAuthEnv } from './config.js';

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
 * Build the Google consent URL to start the connect flow. `state` should be an
 * unguessable CSRF token the caller also stores in the user's session.
 */
export function buildAuthUrl(deps: OAuthCallbackDeps, state: string): string {
  return buildOAuth(deps).getAuthUrl(state);
}

/**
 * Exchange the authorization `code` and persist the resulting tokens.
 *
 * @param code  the `code` query param Google redirected with.
 * @param state the `state` query param; STUB maps it directly to a user id.
 */
export async function handleOAuthCallback(
  deps: OAuthCallbackDeps,
  code: string,
  state: string,
): Promise<OAuthCallbackResult> {
  if (code.length === 0) {
    throw new Error('OAuth callback missing authorization code.');
  }
  const oauth = buildOAuth(deps);
  const tokens = await oauth.exchangeCode(code);

  // STUB: derive a stable user identity from a signed session instead of trusting
  // `state` verbatim. Until the session layer (Supabase auth) lands, the CSRF
  // `state` value doubles as the storage key so the local flow is end-to-end real.
  const userId = state.length > 0 ? state : 'default';

  await deps.store.set(userId, tokens);
  return {
    userId,
    scope: tokens.scope,
    hasRefreshToken: tokens.refreshToken !== undefined,
  };
}
