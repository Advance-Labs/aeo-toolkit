import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @aeo/mcp-core so the registry test never touches the real SDK or network.
const registered: string[] = [];
const fakeCreated = { server: { id: 'fake' }, rateLimiter: { tryRemove: () => true } };

vi.mock('@aeo/mcp-core', () => ({
  createServer: vi.fn(() => fakeCreated),
  registerTool: vi.fn((_target: unknown, def: { name: string }) => {
    registered.push(def.name);
  }),
}));

// Mock @aeo/llm so importing the registry doesn't pull a live client.
vi.mock('@aeo/llm', () => ({
  complete: vi.fn(async () => ({ text: '', model: 'mock' })),
}));

import { buildServer } from './registry.js';
import { createServer, registerTool } from '@aeo/mcp-core';

const EXPECTED_TOOLS = [
  'find_mentions',
  'find_prospects',
  'find_competitor_link_sources',
  'verify_page_links',
  'extract_contact_info',
  'check_page_history',
  'generate_outreach_email',
];

describe('buildServer', () => {
  beforeEach(() => {
    registered.length = 0;
    vi.clearAllMocks();
  });

  it('creates a rate-limited server and registers all seven tools', () => {
    buildServer({
      config: {
        name: 'backlink-mcp',
        version: '0.1.0',
        rateLimit: { capacity: 8, refillPerSec: 1 },
        userAgent: 'test-agent',
        requestTimeoutMs: 1000,
      },
    });

    expect(createServer).toHaveBeenCalledOnce();
    expect(createServer).toHaveBeenCalledWith(
      expect.objectContaining({ rateLimit: { capacity: 8, refillPerSec: 1 } }),
    );
    expect(registerTool).toHaveBeenCalledTimes(EXPECTED_TOOLS.length);
    expect(registered.sort()).toEqual([...EXPECTED_TOOLS].sort());
  });

  it('uses an injected http client and outreach client when provided', async () => {
    const getResource = vi.fn(async () => ({
      url: 'u',
      finalUrl: 'u',
      status: 200,
      ok: true,
      headers: {},
      body: '<a href="https://target.com">t</a>',
      timingMs: 1,
      redirectChain: [],
    }));

    buildServer({
      config: {
        name: 'backlink-mcp',
        version: '0.1.0',
        rateLimit: { capacity: 5, refillPerSec: 1 },
        userAgent: 'test-agent',
        requestTimeoutMs: 1000,
      },
      http: {
        getText: vi.fn(async () => ({ ok: false, status: 0, body: '', url: '' })),
        getResource,
      },
      outreach: { complete: vi.fn(async () => ({ text: '', model: 'm' })) },
    });

    // Seven tools registered against the injected deps without throwing.
    expect(registered).toHaveLength(EXPECTED_TOOLS.length);
  });
});
