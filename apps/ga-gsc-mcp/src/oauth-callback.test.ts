import { describe, expect, it, vi } from 'vitest';
import type { GoogleOAuthTokens, TokenStore } from '@aeo/types';
import type { GoogleOAuth } from '@aeo/google-api';

import { buildAuthUrl, handleOAuthCallback } from './oauth-callback.js';
import type { GoogleOAuthEnv } from './config.js';

const oauthEnv: GoogleOAuthEnv = {
  clientId: 'cid',
  clientSecret: 'secret',
  redirectUri: 'https://mcp.example.com/oauth/callback',
};

function makeStore(): TokenStore & { saved: Map<string, GoogleOAuthTokens> } {
  const saved = new Map<string, GoogleOAuthTokens>();
  return {
    saved,
    async get(id) {
      return saved.get(id) ?? null;
    },
    async set(id, tokens) {
      saved.set(id, tokens);
    },
    async delete(id) {
      saved.delete(id);
    },
  };
}

describe('buildAuthUrl', () => {
  it('delegates to the OAuth client getAuthUrl with the state', () => {
    const getAuthUrl = vi.fn((state: string) => `https://consent?state=${state}`);
    const url = buildAuthUrl(
      {
        oauthEnv,
        store: makeStore(),
        oauthFactory: () =>
          ({ getAuthUrl }) as unknown as Pick<GoogleOAuth, 'exchangeCode' | 'getAuthUrl'>,
      },
      'csrf-1',
    );
    expect(getAuthUrl).toHaveBeenCalledWith('csrf-1');
    expect(url).toContain('csrf-1');
  });
});

describe('handleOAuthCallback', () => {
  it('exchanges the code and persists tokens under the state-derived user id', async () => {
    const store = makeStore();
    const exchangeCode = vi.fn(
      async (): Promise<GoogleOAuthTokens> => ({
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: Date.now() + 3_600_000,
        scope: 'analytics.readonly',
      }),
    );
    const result = await handleOAuthCallback(
      {
        oauthEnv,
        store,
        oauthFactory: () =>
          ({ exchangeCode }) as unknown as Pick<GoogleOAuth, 'exchangeCode' | 'getAuthUrl'>,
      },
      'auth-code',
      'user-42',
    );
    expect(exchangeCode).toHaveBeenCalledWith('auth-code');
    expect(result).toMatchObject({ userId: 'user-42', hasRefreshToken: true });
    expect(store.saved.get('user-42')?.accessToken).toBe('at');
  });

  it('throws on an empty authorization code', async () => {
    await expect(
      handleOAuthCallback(
        {
          oauthEnv,
          store: makeStore(),
          oauthFactory: () => ({ exchangeCode: vi.fn(), getAuthUrl: vi.fn() }),
        },
        '',
        's',
      ),
    ).rejects.toThrow(/missing authorization code/);
  });
});
