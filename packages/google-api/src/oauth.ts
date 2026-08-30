/**
 * Google OAuth 2.0 client (authorization-code flow with refresh tokens).
 *
 * Builds the consent URL, exchanges an authorization code for tokens, and refreshes an access
 * token. Token endpoint HTTP flows through an injectable {@link Fetcher}. Defaults to read-only
 * GA4 + GSC scopes so the toolkit never requests more access than it needs.
 */
import type { GoogleOAuthTokens } from '@advance-labs/types';
import { asNumber, asRecord, asString, defaultFetcher, requestForm, type Fetcher } from './http.js';
import { DEFAULT_READONLY_SCOPES } from './scopes.js';

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** OAuth scopes to request; defaults to read-only GA4 + GSC. */
  scopes?: readonly string[];
  /** Injectable fetch for the token endpoint; defaults to the platform global `fetch`. */
  fetcher?: Fetcher;
}

export class GoogleOAuth {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly scopes: readonly string[];
  private readonly fetcher: Fetcher;

  constructor(cfg: GoogleOAuthConfig) {
    this.clientId = cfg.clientId;
    this.clientSecret = cfg.clientSecret;
    this.redirectUri = cfg.redirectUri;
    this.scopes = cfg.scopes && cfg.scopes.length > 0 ? cfg.scopes : DEFAULT_READONLY_SCOPES;
    this.fetcher = cfg.fetcher ?? defaultFetcher();
  }

  /**
   * Build the Google consent screen URL. `state` is echoed back to the redirect URI for CSRF
   * protection. Requests offline access + consent prompt so a refresh token is always returned.
   * Pure string construction — no network.
   */
  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: this.scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });
    return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
  }

  /**
   * Exchange an authorization code for tokens. LIVE HTTP: POSTs form-encoded credentials to the
   * Google token endpoint and maps the response into {@link GoogleOAuthTokens}.
   */
  async exchangeCode(code: string): Promise<GoogleOAuthTokens> {
    const json = await this.postToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
    });
    return mapTokenResponse(json, undefined);
  }

  /**
   * Refresh an access token using a stored refresh token. LIVE HTTP: POSTs to the Google token
   * endpoint. Google omits `refresh_token` from refresh responses, so the supplied one is carried
   * forward into the returned {@link GoogleOAuthTokens}.
   */
  async refresh(refreshToken: string): Promise<GoogleOAuthTokens> {
    const json = await this.postToken({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    return mapTokenResponse(json, refreshToken);
  }

  /** Send a form-encoded request to the Google token endpoint with client credentials attached. */
  private async postToken(fields: Record<string, string>): Promise<unknown> {
    const form = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      ...fields,
    });
    return requestForm(this.fetcher, GOOGLE_TOKEN_ENDPOINT, form);
  }
}

/**
 * Map a Google token-endpoint JSON response into {@link GoogleOAuthTokens}, computing the absolute
 * expiry from the relative `expires_in` seconds. `fallbackRefreshToken` is used when the response
 * omits a refresh token (as refresh responses do).
 */
function mapTokenResponse(
  json: unknown,
  fallbackRefreshToken: string | undefined,
): GoogleOAuthTokens {
  const root = asRecord(json);
  const accessToken = asString(root['access_token']);
  const expiresIn = asNumber(root['expires_in']);
  const scope = asString(root['scope']);
  const refreshFromResponse = root['refresh_token'];
  const refreshToken =
    typeof refreshFromResponse === 'string' && refreshFromResponse.length > 0
      ? refreshFromResponse
      : fallbackRefreshToken;

  const tokens: GoogleOAuthTokens = {
    accessToken,
    expiresAt: Date.now() + expiresIn * 1000,
    scope,
  };
  if (refreshToken !== undefined) {
    tokens.refreshToken = refreshToken;
  }
  return tokens;
}
