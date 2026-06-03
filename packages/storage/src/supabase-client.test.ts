import { describe, expect, it } from 'vitest';
import { createSupabaseClient } from './supabase-client.js';

describe('createSupabaseClient', () => {
  it('constructs a client exposing the PostgREST `from` entry point (no network on construct)', () => {
    const client = createSupabaseClient({
      url: 'https://example.supabase.co',
      serviceKey: 'service-role-key',
    });
    // Construction is offline; the SDK only issues requests when a query is awaited.
    expect(typeof client.from).toBe('function');
  });

  it('rejects empty url or serviceKey', () => {
    expect(() => createSupabaseClient({ url: '', serviceKey: 'k' })).toThrow();
    expect(() => createSupabaseClient({ url: 'https://x.supabase.co', serviceKey: '' })).toThrow();
  });
});
