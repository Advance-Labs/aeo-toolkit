import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { RateLimiter, RateLimitResult } from '@aeo/storage';
import { describe, expect, it, vi } from 'vitest';

import {
  handleMcpRequest,
  oauthAuthorizationServerMetadata,
  oauthProtectedResourceMetadata,
} from './http.js';

describe('oauth discovery documents', () => {
  it('builds authorization-server metadata from env', () => {
    const meta = oauthAuthorizationServerMetadata({
      MCP_PUBLIC_URL: 'https://mcp.test.com/',
      OAUTH_ISSUER: 'https://auth.test.com',
    });
    expect(meta.issuer).toBe('https://auth.test.com');
    expect(meta.authorization_endpoint).toBe('https://auth.test.com/authorize');
    expect(meta.code_challenge_methods_supported).toContain('S256');
  });

  it('falls back to the resource URL as issuer when none is set', () => {
    const meta = oauthAuthorizationServerMetadata({ MCP_PUBLIC_URL: 'https://mcp.test.com' });
    expect(meta.issuer).toBe('https://mcp.test.com');
  });

  it('builds protected-resource metadata pointing at the auth server', () => {
    const meta = oauthProtectedResourceMetadata({
      MCP_PUBLIC_URL: 'https://mcp.test.com',
      OAUTH_AUTHORIZATION_SERVERS: 'https://auth.test.com, https://auth2.test.com',
    });
    expect(meta.resource).toBe('https://mcp.test.com');
    expect(meta.authorization_servers).toEqual(['https://auth.test.com', 'https://auth2.test.com']);
  });
});

/** A `RateLimiter` whose decision is fixed per construction and records its keys. */
function fakeLimiter(result: RateLimitResult): { limiter: RateLimiter; keys: string[] } {
  const keys: string[] = [];
  const limiter: RateLimiter = {
    check: (key: string) => {
      keys.push(key);
      return Promise.resolve(result);
    },
  };
  return { limiter, keys };
}

/** Minimal `IncomingMessage`: an EventEmitter carrying headers + a socket. */
function fakeReq(headers: Record<string, string> = {}): IncomingMessage {
  const req = new EventEmitter() as unknown as IncomingMessage;
  (req as unknown as { headers: Record<string, string> }).headers = headers;
  (req as unknown as { socket: { remoteAddress?: string } }).socket = {
    remoteAddress: '203.0.113.4',
  };
  return req;
}

/**
 * Capturing `ServerResponse` that records `writeHead`/`end` and resolves `done`
 * on end. Backed by a Proxy so any other method the SDK transport may call
 * (`setHeader`, `write`, `flushHeaders`, …) is a harmless no-op — keeping the
 * test offline and independent of SDK response-handling details.
 */
function fakeRes(): {
  res: ServerResponse;
  done: Promise<void>;
  status: () => number | undefined;
  body: () => string;
  headers: () => Record<string, string>;
} {
  const state = {
    status: undefined as number | undefined,
    body: '',
    headers: {} as Record<string, string>,
    headersSent: false,
  };
  let resolveDone: () => void = () => undefined;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  const target = {
    writeHead(code: number, hdrs?: Record<string, string>) {
      state.status = code;
      if (hdrs) state.headers = hdrs;
      state.headersSent = true;
      return proxy;
    },
    end(chunk?: string) {
      if (typeof chunk === 'string') state.body += chunk;
      resolveDone();
      return proxy;
    },
  };

  const proxy = new Proxy(target as Record<string, unknown>, {
    get(obj, prop: string) {
      if (prop === 'headersSent') return state.headersSent;
      if (prop in obj) return obj[prop];
      // Any other accessed member is a no-op method returning the response.
      return () => proxy;
    },
  }) as unknown as ServerResponse;

  return {
    res: proxy,
    done,
    status: () => state.status,
    body: () => state.body,
    headers: () => state.headers,
  };
}

describe('handleMcpRequest distributed rate-limit guard', () => {
  it('blocks a caller over the limit with a structured 429 and never builds the server', async () => {
    const { limiter, keys } = fakeLimiter({ allowed: false, remaining: 0, resetSeconds: 42 });
    const req = fakeReq({ 'mcp-client-id': 'over-budget' });
    const { res, done, status, body, headers } = fakeRes();

    await handleMcpRequest(req, res, undefined, { rateLimiter: limiter });
    await done;

    expect(status()).toBe(429);
    expect(headers()['retry-after']).toBe('42');
    const parsed = JSON.parse(body()) as { error: string; retryAfterSeconds: number };
    expect(parsed.error).toBe('rate_limited');
    expect(parsed.retryAfterSeconds).toBe(42);
    // Keyed on the explicit client id, not the IP.
    expect(keys).toEqual(['client:over-budget']);
  });

  it('lets a caller under the limit through to the transport (no 429)', async () => {
    const { limiter, keys } = fakeLimiter({ allowed: true, remaining: 59, resetSeconds: 60 });
    // A non-MCP body makes the Streamable-HTTP transport respond with an error
    // and end the response — deterministic and offline. The point under test is
    // that the guard consulted the limiter, derived the bearer key, and did NOT
    // short-circuit with a 429 before handing off to the transport.
    const req = fakeReq({ authorization: 'Bearer caller-tok' });
    (req as unknown as { method: string }).method = 'POST';
    const { res, status } = fakeRes();

    // The guard runs before the transport hand-off; any SDK-level transport
    // behaviour past the guard is out of scope here, so tolerate it. What we
    // assert is that the limiter was consulted with the derived bearer key and
    // the guard did NOT short-circuit with a 429.
    try {
      await handleMcpRequest(
        req,
        res,
        { not: 'a valid jsonrpc message' },
        { rateLimiter: limiter },
      );
    } catch {
      // Transport internals are not under test.
    }

    expect(keys).toEqual(['bearer:caller-tok']);
    expect(status()).not.toBe(429);
  });

  it('consults the injected limiter exactly once per request', async () => {
    const result: RateLimitResult = { allowed: false, remaining: 0, resetSeconds: 5 };
    const check = vi.fn(() => Promise.resolve(result));
    const limiter: RateLimiter = { check };
    const req = fakeReq();
    const { res, done } = fakeRes();

    await handleMcpRequest(req, res, undefined, { rateLimiter: limiter });
    await done;

    expect(check).toHaveBeenCalledTimes(1);
    // No identifying header → falls back to the socket IP key.
    expect(check).toHaveBeenCalledWith('ip:203.0.113.4');
  });
});
