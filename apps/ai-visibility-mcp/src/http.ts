/**
 * Hosted HTTP entry — Streamable HTTP transport for Claude.ai remote connectors,
 * plus the `.well-known` OAuth 2.1 discovery documents Claude.ai fetches to
 * auto-register against this server.
 *
 * Runs statelessly: a fresh transport is built per POST (the recommended shape
 * for serverless / Vercel Functions). The same `buildAiVisibilityServer` factory
 * — and therefore the identical tool registry — backs both this and the stdio
 * entry.
 *
 * For Vercel, re-export `handleMcpRequest` from an `api/[transport]/route.ts`
 * handler. This module also exposes a standalone Node server (`startHttpServer`)
 * for self-hosting / local HTTP testing, started when run directly.
 */
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';

import { mountHttp, wellKnownOAuthMetadata, wellKnownProtectedResource } from '@aeo/mcp-core';
import type { RateLimiter } from '@aeo/storage';

import { buildAiVisibilityServer } from './create-server.js';
import { readOAuthDiscoveryEnv } from './config.js';
import { checkRequestRateLimit, getSharedRateLimiter, rateLimitedBody } from './rate-limit.js';

const OAUTH_AS_PATH = '/.well-known/oauth-authorization-server';
const OAUTH_PR_PATH = '/.well-known/oauth-protected-resource';
const MCP_PATH = '/mcp';

/** Serialise a JSON body with the right content-type. */
function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload).toString(),
  });
  res.end(payload);
}

/** Build the `.well-known/oauth-authorization-server` document from env. */
export function oauthAuthorizationServerMetadata(
  env: Record<string, string | undefined> = process.env,
): ReturnType<typeof wellKnownOAuthMetadata> {
  const { issuer } = readOAuthDiscoveryEnv(env);
  return wellKnownOAuthMetadata({ issuer });
}

/** Build the `.well-known/oauth-protected-resource` document from env. */
export function oauthProtectedResourceMetadata(
  env: Record<string, string | undefined> = process.env,
): ReturnType<typeof wellKnownProtectedResource> {
  const { resource, authorizationServers } = readOAuthDiscoveryEnv(env);
  return wellKnownProtectedResource({
    resource,
    authorizationServers,
    resourceDocumentation: 'https://github.com/aeo-toolkit/ai-visibility-mcp',
  });
}

/** Options for {@link handleMcpRequest}. The limiter is injectable for tests. */
export interface HandleMcpRequestOptions {
  /**
   * Distributed per-caller rate limiter. Defaults to the process-shared limiter
   * built from the environment (Upstash in prod, in-memory fallback otherwise).
   * Tests inject a fake `RateLimiter` to assert allow/block behaviour offline.
   */
  rateLimiter?: RateLimiter;
}

/**
 * Send the structured 429 a caller receives when it exceeds its per-caller
 * budget. Sets `Retry-After` so well-behaved clients back off automatically.
 */
function sendRateLimited(res: ServerResponse, resetSeconds: number): void {
  const body = JSON.stringify(rateLimitedBody({ allowed: false, remaining: 0, resetSeconds }));
  res.writeHead(429, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body).toString(),
    'retry-after': String(Math.max(resetSeconds, 0)),
  });
  res.end(body);
}

/**
 * Handle one MCP request: enforce the distributed per-caller rate limit, then —
 * when allowed — build a fresh server + stateless Streamable-HTTP transport and
 * pump the (optionally pre-parsed) request through it. `parsedBody` lets a
 * framework that already consumed the stream (e.g. Vercel/Express JSON parsing)
 * avoid double-reading the body.
 *
 * A rejected caller gets a structured 429 (`{ error: 'rate_limited', ... }`) with
 * a `Retry-After` header instead of reaching the tool registry.
 */
export async function handleMcpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  parsedBody?: unknown,
  options: HandleMcpRequestOptions = {},
): Promise<void> {
  const limiter = options.rateLimiter ?? getSharedRateLimiter();
  const { result } = await checkRequestRateLimit(limiter, req);
  if (!result.allowed) {
    sendRateLimited(res, result.resetSeconds);
    return;
  }

  const created = buildAiVisibilityServer();
  const transport = await mountHttp(created, { sessionIdGenerator: undefined });
  // Close the transport when the client disconnects to free the per-request server.
  res.on('close', () => {
    void transport.close();
  });
  await transport.handleRequest(req, res, parsedBody);
}

/** Read the full request body as a UTF-8 string (for non-framework Node serving). */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * Start a standalone Node HTTP server exposing the MCP endpoint at `/mcp` and
 * the two `.well-known` OAuth discovery documents. Returns the listening server.
 */
export function startHttpServer(port = Number(process.env.PORT ?? 8787)) {
  const httpServer = createHttpServer((req, res) => {
    void (async () => {
      try {
        const url = req.url ?? '/';
        const method = req.method ?? 'GET';

        if (method === 'GET' && url.startsWith(OAUTH_AS_PATH)) {
          sendJson(res, 200, oauthAuthorizationServerMetadata());
          return;
        }
        if (method === 'GET' && url.startsWith(OAUTH_PR_PATH)) {
          sendJson(res, 200, oauthProtectedResourceMetadata());
          return;
        }
        if (url.startsWith(MCP_PATH)) {
          // Parse JSON bodies ourselves for POST; GET/DELETE carry no body.
          let parsed: unknown;
          if (method === 'POST') {
            const raw = await readBody(req);
            parsed = raw.length > 0 ? (JSON.parse(raw) as unknown) : undefined;
          }
          await handleMcpRequest(req, res, parsed);
          return;
        }
        sendJson(res, 404, { error: 'not_found', path: url });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!res.headersSent) sendJson(res, 500, { error: 'internal_error', message });
        else res.end();
      }
    })();
  });

  httpServer.listen(port, () => {
    process.stderr.write(`ai-visibility-mcp: HTTP transport listening on :${port}${MCP_PATH}\n`);
  });
  return httpServer;
}

// Start the server when this module is the process entrypoint.
// `import.meta.url` ending the argv path means we were run directly (`node dist/http.js`).
const invokedPath = process.argv[1] ?? '';
if (import.meta.url === `file://${invokedPath}` || import.meta.url.endsWith(invokedPath)) {
  startHttpServer();
}
