import { describe, expect, it } from 'vitest';
import { BingKeyResolver, InMemoryBingKeyStore } from './bing.js';

describe('BingKeyResolver', () => {
  it('prefers the request-scoped key over everything', async () => {
    const store = new InMemoryBingKeyStore();
    await store.set('u1', 'stored-key');
    const resolver = new BingKeyResolver({ store, staticApiKey: 'env-key' });
    await expect(resolver.resolveApiKey('u1', 'request-key')).resolves.toBe('request-key');
  });

  it('never persists the request-scoped key', async () => {
    const store = new InMemoryBingKeyStore();
    const resolver = new BingKeyResolver({ store, staticApiKey: null });
    await resolver.resolveApiKey('u1', 'request-key');
    await expect(store.get('u1')).resolves.toBeNull();
  });

  it('falls back to the store when no request key is present', async () => {
    const store = new InMemoryBingKeyStore();
    await store.set('u1', 'stored-key');
    const resolver = new BingKeyResolver({ store, staticApiKey: 'env-key' });
    await expect(resolver.resolveApiKey('u1')).resolves.toBe('stored-key');
  });

  it('falls back to the env key when the store is empty', async () => {
    const resolver = new BingKeyResolver({
      store: new InMemoryBingKeyStore(),
      staticApiKey: 'env-key',
    });
    await expect(resolver.resolveApiKey('u1')).resolves.toBe('env-key');
  });

  it('throws a named McpToolError when no credential exists anywhere', async () => {
    const resolver = new BingKeyResolver({
      store: new InMemoryBingKeyStore(),
      staticApiKey: null,
    });
    await expect(resolver.resolveApiKey('u1')).rejects.toThrow(/BING_API_KEY/);
  });

  it('treats an empty or whitespace request key as absent', async () => {
    const resolver = new BingKeyResolver({
      store: new InMemoryBingKeyStore(),
      staticApiKey: 'env-key',
    });
    await expect(resolver.resolveApiKey('u1', '   ')).resolves.toBe('env-key');
  });
});
