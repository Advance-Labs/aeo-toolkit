/**
 * Hosted entry: GA4 + GSC MCP server over HTTP (Streamable HTTP, used by Claude.ai
 * remote connectors) plus the `.well-known` OAuth discovery endpoints and the
 * Google OAuth callback.
 *
 * Stateless per-request model (right for Vercel Functions / serverless): each POST
 * to `/mcp` spins up a fresh `CreatedServer`, registers the shared tool surface
 * against a context carrying the request's BYOK bearer token, mounts a per-request
 * Streamable HTTP transport, and hands the request off. The well-known docs let
 * Claude.ai auto-register; the callback exchanges the code and fills the TokenStore.
 *
 * The pure pieces (routing, discovery, token extraction, callback exchange) are
 * unit-tested; the Node `http` plumbing here is the thin, untested transport seam.
 */
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';

import { createServer, mountHttp } from '@aeo/mcp-core';
import type { TokenStore } from '@aeo/types';

import { loadConfig, type ServerConfig } from './config.js';
import {
  createDefaultTokenResolver,
  createTokenStore,
  DEFAULT_USER_ID,
  type TokenResolver,
} from './auth.js';
import { defaultClientFactory, registerAllTools, type ToolContext } from './tools/index.js';
import { authServerMetadata, protectedResourceMetadata } from './discovery.js';
import { bearerToken, routeFor } from './http-util.js';
import { buildAuthUrl, handleOAuthCallback } from './oauth-callback.js';

const VERSION = '0.1.0';

/** Process-wide singletons shared across stateless requests (store survives the process). */
export interface HttpRuntime {
  config: ServerConfig;
  store: TokenStore;
  tokens: TokenResolver;
}

/** Build the shared runtime (store + resolver) once per process. */
export function buildRuntime(env: NodeJS.ProcessEnv = process.env): HttpRuntime {
  const config = loadConfig(env);
  // Env-gated: Supabase-backed (durable, multi-instance) when configured, else in-memory.
  const store = createTokenStore(config.supabase);
  const tokens = createDefaultTokenResolver({
    oauthEnv: config.oauth,
    staticAccessToken: config.staticAccessToken,
    store,
  });
  return { config, store, tokens };
}

/** Build a per-request MCP server bound to the request's BYOK token. */
function buildRequestServer(runtime: HttpRuntime, requestToken: string | null) {
  const created = createServer({
    name: 'ga-gsc-mcp',
    version: VERSION,
    rateLimit: runtime.config.rateLimit,
  });
  const ctx: ToolContext = {
    tokens: runtime.tokens,
    clients: defaultClientFactory,
    userId: DEFAULT_USER_ID,
    requestToken,
  };
  registerAllTools(created, ctx);
  return created;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

/** Read and JSON-parse a request body; returns `undefined` for an empty body. */
async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return undefined;
  const raw = Buffer.concat(chunks).toString('utf8');
  if (raw.trim().length === 0) return undefined;
  return JSON.parse(raw) as unknown;
}

/**
 * The request handler. Exported so a Vercel Function or test harness can invoke it
 * directly without binding a port.
 */
export async function handleHttp(
  runtime: HttpRuntime,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? '/', runtime.config.publicUrl);
  const route = routeFor(req.method ?? 'GET', url.pathname);

  switch (route) {
    case 'well-known-oauth':
      return sendJson(res, 200, authServerMetadata(runtime.config.publicUrl));

    case 'well-known-protected-resource':
      return sendJson(res, 200, protectedResourceMetadata(runtime.config.publicUrl));

    case 'health':
      return sendJson(res, 200, { ok: true, name: 'ga-gsc-mcp', version: VERSION });

    case 'authorize': {
      if (runtime.config.oauth === null) {
        return sendJson(res, 501, { error: 'oauth_not_configured' });
      }
      // The identity to bind into the signed state. Single-tenant deployments use the
      // default user; a `user` query param lets a multi-tenant front-end carry the id.
      const userId = url.searchParams.get('user') ?? DEFAULT_USER_ID;
      try {
        const consentUrl = buildAuthUrl(
          { oauthEnv: runtime.config.oauth, store: runtime.store },
          userId,
        );
        res.writeHead(302, { location: consentUrl });
        res.end();
      } catch {
        // signState throws when OAUTH_STATE_SECRET is unset — surface a clear 501.
        return sendJson(res, 501, { error: 'oauth_state_secret_missing' });
      }
      return;
    }

    case 'oauth-callback': {
      if (runtime.config.oauth === null) {
        return sendJson(res, 501, { error: 'oauth_not_configured' });
      }
      const code = url.searchParams.get('code') ?? '';
      const state = url.searchParams.get('state') ?? '';
      try {
        const result = await handleOAuthCallback(
          { oauthEnv: runtime.config.oauth, store: runtime.store },
          code,
          state,
        );
        // Do not echo tokens; just confirm the connection succeeded.
        return sendJson(res, 200, {
          connected: true,
          userId: result.userId,
          scope: result.scope,
          hasRefreshToken: result.hasRefreshToken,
        });
      } catch (err: unknown) {
        return sendJson(res, 400, { error: 'oauth_exchange_failed', message: String(err) });
      }
    }

    case 'mcp': {
      const token = bearerToken(req.headers.authorization);
      const created = buildRequestServer(runtime, token);
      // Stateless per-request transport (sessionIdGenerator: undefined by default).
      const transport = await mountHttp(created);
      const body = await readJsonBody(req).catch(() => undefined);
      // STUB: `transport.handleRequest` is the SDK seam wrapped by @aeo/mcp-core's
      // mountHttp; it pumps the JSON-RPC request/response over the Node req/res.
      await transport.handleRequest(req, res, body);
      return;
    }

    case 'not-found':
    default:
      return sendJson(res, 404, { error: 'not_found', path: url.pathname });
  }
}

/** Boot the Node HTTP server. */
export function main(): void {
  const runtime = buildRuntime();
  const port = Number.parseInt(process.env.PORT ?? '8787', 10);
  const server = createHttpServer((req, res) => {
    handleHttp(runtime, req, res).catch((err: unknown) => {
      if (!res.headersSent) {
        sendJson(res, 500, { error: 'internal_error', message: String(err) });
      } else {
        res.end();
      }
    });
  });
  server.listen(port, () => {
    process.stderr.write(
      `[ga-gsc-mcp] HTTP transport on :${port} (public: ${runtime.config.publicUrl})\n`,
    );
  });
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}
