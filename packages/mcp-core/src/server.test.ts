import { describe, expect, it, vi, beforeEach } from 'vitest';
import { z } from 'zod';

/**
 * The SDK `McpServer` is mocked so no real transport or protocol negotiation
 * runs. We capture the callback `registerTool` hands the SDK and invoke it
 * directly to assert our wrapper's behaviour (rate-limit short-circuit, error
 * normalisation, result pass-through).
 */
// `vi.hoisted` lets the mock factory (which Vitest hoists above imports) safely
// reference this spy without tripping the "cannot access before initialization" trap.
const { registerToolSpy } = vi.hoisted(() => ({ registerToolSpy: vi.fn() }));

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => {
  class McpServer {
    name: string;
    version: string;
    constructor(opts: { name: string; version: string }) {
      this.name = opts.name;
      this.version = opts.version;
    }
    registerTool(...args: unknown[]) {
      registerToolSpy(...args);
    }
  }
  return { McpServer };
});

// Imported after the mock is registered.
const { createServer, registerTool } = await import('./server.js');

type CapturedCallback = (args: unknown) => Promise<unknown>;

function lastCallback(): CapturedCallback {
  const call = registerToolSpy.mock.calls.at(-1);
  if (!call) throw new Error('registerTool was not called');
  return call[2] as CapturedCallback;
}

describe('createServer', () => {
  beforeEach(() => registerToolSpy.mockClear());

  it('creates a server without a rate limiter when none is configured', () => {
    const created = createServer({ name: 'test', version: '0.1.0' });
    expect(created.server).toBeDefined();
    expect(created.rateLimiter).toBeUndefined();
  });

  it('attaches a rate limiter when rateLimit is configured', () => {
    const created = createServer({
      name: 'test',
      version: '0.1.0',
      rateLimit: { capacity: 1, refillPerSec: 0 },
    });
    expect(created.rateLimiter).toBeDefined();
  });
});

describe('registerTool wrapper', () => {
  beforeEach(() => registerToolSpy.mockClear());

  it('forwards name, config (with title) and a callback to the SDK', () => {
    const created = createServer({ name: 'test', version: '0.1.0' });
    registerTool(created, {
      name: 'echo',
      title: 'Echo',
      description: 'echoes input',
      inputSchema: { value: z.string() },
      handler: ({ value }) => ({ content: [{ type: 'text', text: value }] }),
    });

    const call = registerToolSpy.mock.calls.at(-1);
    expect(call?.[0]).toBe('echo');
    expect(call?.[1]).toMatchObject({ title: 'Echo', description: 'echoes input' });
    expect(typeof call?.[2]).toBe('function');
  });

  it('passes a successful handler result straight through', async () => {
    const created = createServer({ name: 'test', version: '0.1.0' });
    registerTool(created, {
      name: 'echo',
      description: 'echoes input',
      inputSchema: { value: z.string() },
      handler: ({ value }) => ({ content: [{ type: 'text', text: value }] }),
    });
    const result = await lastCallback()({ value: 'hi' });
    expect(result).toEqual({ content: [{ type: 'text', text: 'hi' }] });
  });

  it('normalises a thrown error into a structured tool error', async () => {
    const created = createServer({ name: 'test', version: '0.1.0' });
    registerTool(created, {
      name: 'boom',
      description: 'always throws',
      inputSchema: {},
      handler: () => {
        throw new Error('kaboom');
      },
    });
    const result = (await lastCallback()({})) as {
      isError: boolean;
      content: { text: string }[];
    };
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe('kaboom');
  });

  it('short-circuits with a rate-limit error when the bucket is exhausted', async () => {
    const created = createServer({
      name: 'test',
      version: '0.1.0',
      rateLimit: { capacity: 1, refillPerSec: 0 },
    });
    registerTool(created, {
      name: 'limited',
      description: 'rate limited',
      inputSchema: {},
      handler: () => ({ content: [{ type: 'text', text: 'ok' }] }),
    });

    const cb = lastCallback();
    // First call consumes the single token.
    const first = (await cb({})) as { isError?: boolean };
    expect(first.isError).toBeUndefined();
    // Second call is rejected by the limiter (refillPerSec: 0 → never refills).
    const second = (await cb({})) as { isError: boolean; content: { text: string }[] };
    expect(second.isError).toBe(true);
    expect(second.content[0]?.text).toContain('Rate limit exceeded');
  });
});
