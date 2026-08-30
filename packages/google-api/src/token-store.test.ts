import { describe, expect, it } from 'vitest';
import type { GoogleOAuthTokens } from '@advance-labs/types';
import { InMemoryTokenStore } from './token-store.js';

const tokens: GoogleOAuthTokens = {
  accessToken: 'a',
  refreshToken: 'r',
  expiresAt: 1_700_000_000_000,
  scope: 'https://www.googleapis.com/auth/analytics.readonly',
};

describe('InMemoryTokenStore', () => {
  it('returns null for an unknown user', async () => {
    const store = new InMemoryTokenStore();
    await expect(store.get('nobody')).resolves.toBeNull();
  });

  it('round-trips tokens through set/get', async () => {
    const store = new InMemoryTokenStore();
    await store.set('user-1', tokens);
    await expect(store.get('user-1')).resolves.toEqual(tokens);
  });

  it('clones on write so later mutation does not corrupt the store', async () => {
    const store = new InMemoryTokenStore();
    const mutable: GoogleOAuthTokens = { ...tokens };
    await store.set('user-2', mutable);
    mutable.accessToken = 'TAMPERED';

    const fetched = await store.get('user-2');
    expect(fetched?.accessToken).toBe('a');
  });

  it('clones on read so the returned object is detached from the store', async () => {
    const store = new InMemoryTokenStore();
    await store.set('user-3', tokens);
    const first = await store.get('user-3');
    expect(first).not.toBeNull();
    if (first) first.accessToken = 'CHANGED';

    const second = await store.get('user-3');
    expect(second?.accessToken).toBe('a');
  });

  it('deletes a stored entry', async () => {
    const store = new InMemoryTokenStore();
    await store.set('user-4', tokens);
    await store.delete('user-4');
    await expect(store.get('user-4')).resolves.toBeNull();
  });

  it('delete is a no-op for an unknown user', async () => {
    const store = new InMemoryTokenStore();
    await expect(store.delete('ghost')).resolves.toBeUndefined();
  });

  it('preserves tokens without a refresh token', async () => {
    const store = new InMemoryTokenStore();
    const noRefresh: GoogleOAuthTokens = {
      accessToken: 'x',
      expiresAt: 123,
      scope: 's',
    };
    await store.set('user-5', noRefresh);
    const fetched = await store.get('user-5');
    expect(fetched).toEqual(noRefresh);
    expect(fetched && 'refreshToken' in fetched).toBe(false);
  });
});
