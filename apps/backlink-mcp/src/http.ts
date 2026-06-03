#!/usr/bin/env node
/**
 * HTTP/SSE entrypoint — hosted / remote (Vercel, any Node host).
 *
 * Wires the *same* tool registry as the stdio entrypoint over Streamable HTTP. It
 * runs statelessly: a fresh server + transport is built per request (the right
 * shape for serverless / Vercel Functions where instances are ephemeral). It also
 * serves the OAuth 2.1 `.well-known` discovery documents so Claude.ai can
 * auto-register the remote connector.
 *
 * Run (after build):  node dist/http.js
 * Env (in addition to the registry env vars):
 *   PORT                     — listen port (default 3000)
 *   BACKLINK_PUBLIC_URL      — public origin for OAuth discovery (default http://localhost:PORT)
 *   BACKLINK_AUTH_SERVER     — external OAuth issuer for protected-resource metadata (optional)
 */
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { mountHttp, wellKnownOAuthMetadata, wellKnownProtectedResource } from '@aeo/mcp-core';
import { buildServer } from './registry.js';
import { resolveConfig } from './config.js';

const MCP_PATH = '/mcp';

/** Read and JSON-parse a request body; returns `undefined` on empty/invalid. */
async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  // `IncomingMessage` is an async iterable of Buffers; type it explicitly to
  // avoid the `any` element type from @types/node and keep strict mode happy.
  const stream = req as AsyncIterable<Buffer>;
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (raw.trim() === '') return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

/**
 * Handle one MCP JSON-RPC request statelessly: build a fresh server, mount a
 * Streamable HTTP transport (sessionless), and pump the request through it.
 * Exported so a Vercel function handler can reuse the exact same logic.
 */
export async function handleMcpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const created = buildServer();
  const transport = await mountHttp(created, { sessionIdGenerator: undefined });
  res.on('close', () => {
    void transport.close();
    void created.server.close();
  });
  await transport.handleRequest(req, res, body);
}

/** Resolve the public origin used in OAuth discovery documents. */
function publicOrigin(port: number): string {
  const fromEnv = process.env.BACKLINK_PUBLIC_URL?.trim();
  return fromEnv && fromEnv !== '' ? fromEnv : `http://localhost:${port}`;
}

function serveDiscovery(res: ServerResponse, kind: 'as' | 'pr', origin: string): void {
  if (kind === 'as') {
    sendJson(res, 200, wellKnownOAuthMetadata({ issuer: origin }));
    return;
  }
  const authServer = process.env.BACKLINK_AUTH_SERVER?.trim();
  sendJson(
    res,
    200,
    wellKnownProtectedResource({
      resource: origin,
      authorizationServers: [authServer && authServer !== '' ? authServer : origin],
      resourceDocumentation: `${origin}${MCP_PATH}`,
    }),
  );
}

function start(): void {
  const config = resolveConfig();
  const port = Number(process.env.PORT ?? 3000) || 3000;
  const origin = publicOrigin(port);

  const httpServer = createHttpServer((req, res) => {
    const url = req.url ?? '/';
    const path = url.split('?')[0] ?? '/';

    void (async () => {
      try {
        if (req.method === 'GET' && path === '/healthz') {
          sendJson(res, 200, { ok: true, name: config.name, version: config.version });
          return;
        }
        if (req.method === 'GET' && path === '/.well-known/oauth-authorization-server') {
          serveDiscovery(res, 'as', origin);
          return;
        }
        if (req.method === 'GET' && path === '/.well-known/oauth-protected-resource') {
          serveDiscovery(res, 'pr', origin);
          return;
        }
        if (req.method === 'POST' && path === MCP_PATH) {
          await handleMcpRequest(req, res);
          return;
        }
        sendJson(res, 404, { error: 'not_found', path });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!res.headersSent) sendJson(res, 500, { error: 'internal_error', message });
        else res.end();
      }
    })();
  });

  httpServer.listen(port, () => {
    process.stderr.write(`${config.name} v${config.version} listening on ${origin}${MCP_PATH}\n`);
  });
}

// Only auto-start when run directly (not when imported by a serverless adapter).
if (process.env.BACKLINK_HTTP_NO_LISTEN !== '1') {
  start();
}
