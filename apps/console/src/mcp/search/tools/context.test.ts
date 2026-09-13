import { describe, expect, it, vi } from 'vitest';
import { BingKeyResolver, InMemoryBingKeyStore } from '../auth/bing.js';
import { bingFor, type ClientFactory, type ToolContext } from './context.js';

function ctxWith(factory: ClientFactory, requestBingKey?: string | null): ToolContext {
  return {
    tokens: { resolveAccessToken: async () => 'google-token' } as ToolContext['tokens'],
    bingKeys: new BingKeyResolver({
      store: new InMemoryBingKeyStore(),
      staticApiKey: 'env-key',
    }),
    clients: factory,
    userId: 'u1',
    requestToken: null,
    requestBingKey: requestBingKey ?? null,
  };
}

describe('bingFor', () => {
  it('builds a client with the resolved key', async () => {
    const bing = vi.fn(() => ({}) as never);
    await bingFor(ctxWith({ ga4: vi.fn(), gsc: vi.fn(), bing } as unknown as ClientFactory));
    expect(bing).toHaveBeenCalledWith('env-key');
  });

  it('passes the request-scoped key through in preference to the env key', async () => {
    const bing = vi.fn(() => ({}) as never);
    await bingFor(
      ctxWith({ ga4: vi.fn(), gsc: vi.fn(), bing } as unknown as ClientFactory, 'req-key'),
    );
    expect(bing).toHaveBeenCalledWith('req-key');
  });
});
