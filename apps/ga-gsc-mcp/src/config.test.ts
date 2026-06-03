import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('returns oauth=null when credentials are incomplete', () => {
    const cfg = loadConfig({ GOOGLE_CLIENT_ID: 'cid' });
    expect(cfg.oauth).toBeNull();
  });

  it('builds oauth config when all three credentials are present', () => {
    const cfg = loadConfig({
      GOOGLE_CLIENT_ID: 'cid',
      GOOGLE_CLIENT_SECRET: 'secret',
      GOOGLE_REDIRECT_URI: 'https://x.com/cb',
    });
    expect(cfg.oauth).toEqual({
      clientId: 'cid',
      clientSecret: 'secret',
      redirectUri: 'https://x.com/cb',
    });
  });

  it('defaults the public url and rate limit, and reads overrides', () => {
    expect(loadConfig({}).publicUrl).toBe('http://localhost:8787');
    const cfg = loadConfig({ MCP_PUBLIC_URL: 'https://mcp.example.com', MCP_RATE_CAPACITY: '50' });
    expect(cfg.publicUrl).toBe('https://mcp.example.com');
    expect(cfg.rateLimit.capacity).toBe(50);
  });

  it('picks up a static access token for local dev', () => {
    expect(loadConfig({ GOOGLE_ACCESS_TOKEN: 'tok' }).staticAccessToken).toBe('tok');
    expect(loadConfig({}).staticAccessToken).toBeNull();
  });

  it('returns supabase=null unless both URL and service-role key are present', () => {
    expect(loadConfig({}).supabase).toBeNull();
    expect(loadConfig({ SUPABASE_URL: 'https://x.supabase.co' }).supabase).toBeNull();
    expect(loadConfig({ SUPABASE_SERVICE_ROLE_KEY: 'srk' }).supabase).toBeNull();
  });

  it('builds supabase config from URL + service-role key, with optional encryption key', () => {
    const cfg = loadConfig({
      SUPABASE_URL: 'https://x.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'srk',
    });
    expect(cfg.supabase).toEqual({
      url: 'https://x.supabase.co',
      serviceRoleKey: 'srk',
      encryptionKey: null,
    });

    const encrypted = loadConfig({
      SUPABASE_URL: 'https://x.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'srk',
      TOKEN_ENCRYPTION_KEY: 'passphrase',
    });
    expect(encrypted.supabase?.encryptionKey).toBe('passphrase');
  });
});
