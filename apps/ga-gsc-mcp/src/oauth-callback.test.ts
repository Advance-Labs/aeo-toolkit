import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoogleOAuthTokens, TokenStore } from '@aeo/types';
import type { GoogleOAuth } from '@aeo/google-api';

import { buildAuthUrl, handleOAuthCallback } from './oauth-callback.js';
import { signState, STATE_TTL_MS } from './state.js';
import type { GoogleOAuthEnv } from './config.js';

const oauthEnv: GoogleOAuthEnv = {
  clientId: 'cid',
  clientSecret: 'secret',
  redirectUri: 'https://mcp.example.com/oauth/callback',
};

const SECRET = 'oauth-state-test-secret';

beforeEach(() => {
  process.env.OAUTH_STATE_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.OAUTH_STATE_SECRET;
});

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
  it('signs the user id into the state and passes it to getAuthUrl', () => {
    const getAuthUrl = vi.fn((state: string) => `https://consent?state=${state}`);
    const url = buildAuthUrl(
      {
        oauthEnv,
        store: makeStore(),
        oauthFactory: () =>
          ({ getAuthUrl }) as unknown as Pick<GoogleOAuth, 'exchangeCode' | 'getAuthUrl'>,
      },
      'user-7',
    );
    // The state passed to getAuthUrl is the signed token, not the raw user id.
    const passedState = getAuthUrl.mock.calls[0]?.[0];
    expect(passedState).toBeDefined();
    expect(passedState).not.toBe('user-7');
    expect(passedState).toMatch(/\./); // userId.timestamp.signature
    expect(url).toContain(passedState!);
  });
});

describe('handleOAuthCallback', () => {
  it('verifies the signed state and persists tokens under the verified user id', async () => {
    const store = makeStore();
    const exchangeCode = vi.fn(
      async (): Promise<GoogleOAuthTokens> => ({
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: Date.now() + 3_600_000,
        scope: 'analytics.readonly',
      }),
    );
    const state = signState('user-42');
    const result = await handleOAuthCallback(
      {
        oauthEnv,
        store,
        oauthFactory: () =>
          ({ exchangeCode }) as unknown as Pick<GoogleOAuth, 'exchangeCode' | 'getAuthUrl'>,
      },
      'auth-code',
      state,
    );
    expect(exchangeCode).toHaveBeenCalledWith('auth-code');
    expect(result).toMatchObject({ userId: 'user-42', hasRefreshToken: true });
    expect(store.saved.get('user-42')?.accessToken).toBe('at');
  });

  it('round-trips a signed state from buildAuthUrl back through the callback', async () => {
    const store = makeStore();
    let capturedState = '';
    const getAuthUrl = vi.fn((state: string) => {
      capturedState = state;
      return `https://consent?state=${state}`;
    });
    const exchangeCode = vi.fn(
      async (): Promise<GoogleOAuthTokens> => ({
        accessToken: 'at',
        expiresAt: Date.now() + 3_600_000,
        scope: 's',
      }),
    );
    buildAuthUrl(
      {
        oauthEnv,
        store,
        oauthFactory: () =>
          ({ getAuthUrl }) as unknown as Pick<GoogleOAuth, 'exchangeCode' | 'getAuthUrl'>,
      },
      'round-trip-user',
    );
    const result = await handleOAuthCallback(
      {
        oauthEnv,
        store,
        oauthFactory: () =>
          ({ exchangeCode }) as unknown as Pick<GoogleOAuth, 'exchangeCode' | 'getAuthUrl'>,
      },
      'auth-code',
      capturedState,
    );
    expect(result.userId).toBe('round-trip-user');
  });

  it('rejects a tampered state without exchanging the code', async () => {
    const exchangeCode = vi.fn();
    const state = signState('user-42');
    const tampered = `${state}x`;
    await expect(
      handleOAuthCallback(
        {
          oauthEnv,
          store: makeStore(),
          oauthFactory: () =>
            ({ exchangeCode }) as unknown as Pick<GoogleOAuth, 'exchangeCode' | 'getAuthUrl'>,
        },
        'auth-code',
        tampered,
      ),
    ).rejects.toThrow(/state/i);
    expect(exchangeCode).not.toHaveBeenCalled();
  });

  it('rejects an expired state', async () => {
    const exchangeCode = vi.fn();
    const issuedAt = 1_000_000;
    const state = signState('user-42', issuedAt);
    await expect(
      handleOAuthCallback(
        {
          oauthEnv,
          store: makeStore(),
          oauthFactory: () =>
            ({ exchangeCode }) as unknown as Pick<GoogleOAuth, 'exchangeCode' | 'getAuthUrl'>,
        },
        'auth-code',
        state,
        issuedAt + STATE_TTL_MS + 1,
      ),
    ).rejects.toThrow(/expired/i);
    expect(exchangeCode).not.toHaveBeenCalled();
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
        signState('s'),
      ),
    ).rejects.toThrow(/missing authorization code/);
  });
});
