import { describe, expect, it } from 'vitest';
import { GoogleApiError } from './http.js';
import { GoogleOAuth } from './oauth.js';
import { GA4_READONLY_SCOPE, GSC_READONLY_SCOPE } from './scopes.js';
import { errorFetcher, jsonFetcher, parseBody } from './test-helpers.js';

const baseConfig = {
  clientId: 'client-abc',
  clientSecret: 'secret-xyz',
  redirectUri: 'https://app.example.com/oauth/callback',
};

describe('GoogleOAuth.getAuthUrl', () => {
  it('builds a consent URL with default read-only scopes and the state param', () => {
    const oauth = new GoogleOAuth({ ...baseConfig, fetcher: jsonFetcher({}).fetcher });
    const url = new URL(oauth.getAuthUrl('state-token'));

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('client-abc');
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.com/oauth/callback');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('state')).toBe('state-token');
    expect(url.searchParams.get('scope')).toBe(`${GA4_READONLY_SCOPE} ${GSC_READONLY_SCOPE}`);
  });

  it('honors custom scopes when provided', () => {
    const oauth = new GoogleOAuth({
      ...baseConfig,
      scopes: ['https://www.googleapis.com/auth/custom'],
      fetcher: jsonFetcher({}).fetcher,
    });
    const url = new URL(oauth.getAuthUrl('s'));
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/custom');
  });
});

describe('GoogleOAuth.exchangeCode', () => {
  it('posts form-encoded credentials and maps the token response', async () => {
    const mock = jsonFetcher({
      access_token: 'access-1',
      refresh_token: 'refresh-1',
      expires_in: 3600,
      scope: GA4_READONLY_SCOPE,
      token_type: 'Bearer',
    });
    const before = Date.now();
    const oauth = new GoogleOAuth({ ...baseConfig, fetcher: mock.fetcher });

    const tokens = await oauth.exchangeCode('auth-code-1');

    const call = mock.calls[0];
    expect(call).toBeDefined();
    if (!call) throw new Error('expected a recorded call');
    expect(call.url).toBe('https://oauth2.googleapis.com/token');
    expect(call.init?.method).toBe('POST');
    expect(call.init?.headers?.['Content-Type']).toBe('application/x-www-form-urlencoded');

    const body = parseBody(call);
    expect(body['grant_type']).toBe('authorization_code');
    expect(body['code']).toBe('auth-code-1');
    expect(body['client_id']).toBe('client-abc');
    expect(body['client_secret']).toBe('secret-xyz');
    expect(body['redirect_uri']).toBe('https://app.example.com/oauth/callback');

    expect(tokens.accessToken).toBe('access-1');
    expect(tokens.refreshToken).toBe('refresh-1');
    expect(tokens.scope).toBe(GA4_READONLY_SCOPE);
    // expiresAt is an absolute ms timestamp derived from expires_in (3600s).
    expect(tokens.expiresAt).toBeGreaterThanOrEqual(before + 3600 * 1000);
    expect(tokens.expiresAt).toBeLessThanOrEqual(Date.now() + 3600 * 1000);
  });
});

describe('GoogleOAuth.refresh', () => {
  it('posts a refresh_token grant and carries the refresh token forward when omitted', async () => {
    // Google omits refresh_token from refresh responses.
    const mock = jsonFetcher({
      access_token: 'access-2',
      expires_in: 3600,
      scope: GSC_READONLY_SCOPE,
      token_type: 'Bearer',
    });
    const oauth = new GoogleOAuth({ ...baseConfig, fetcher: mock.fetcher });

    const tokens = await oauth.refresh('stored-refresh');

    const call = mock.calls[0];
    expect(call).toBeDefined();
    if (!call) throw new Error('expected a recorded call');
    const body = parseBody(call);
    expect(body['grant_type']).toBe('refresh_token');
    expect(body['refresh_token']).toBe('stored-refresh');

    expect(tokens.accessToken).toBe('access-2');
    // refresh_token was absent from the response → carried forward from the input.
    expect(tokens.refreshToken).toBe('stored-refresh');
  });

  it('throws GoogleApiError when the token endpoint rejects the refresh', async () => {
    const mock = errorFetcher(400, 'invalid_grant');
    const oauth = new GoogleOAuth({ ...baseConfig, fetcher: mock.fetcher });
    await expect(oauth.refresh('expired')).rejects.toBeInstanceOf(GoogleApiError);
  });
});
