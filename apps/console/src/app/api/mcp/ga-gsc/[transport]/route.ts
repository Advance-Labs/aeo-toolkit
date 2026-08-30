/**
 * GA4 + GSC MCP server, mounted as a Next.js App Router route handler.
 *
 * Unlike the other two servers, ga-gsc's BYOK credential is the request's
 * `Authorization` bearer token (a Google access token), so the `mcp-handler`
 * handler is built *inside* the request function — this captures the per-request
 * bearer and injects it into a fresh tool context (the dynamic-routing shape from
 * the mcp-handler docs). The process-shared runtime (env-gated Supabase/in-memory
 * token store + resolver) is reused across requests.
 *
 * A per-caller distributed rate-limit gate runs before the transport hand-off.
 *
 * Node runtime: the tools call the Google Analytics + Search Console APIs.
*
 * ROUTE SHAPE: this file MUST live under a `[transport]` segment. `mcp-handler`
 * derives its endpoints from `basePath` as `${basePath}/mcp`, `${basePath}/sse` and
 * `${basePath}/message`, then compares the request pathname against them. Mounted
 * directly at the basePath it answers every request with its own plain-text
 * "Not found" — a 404 that looks like a routing bug and is not. The dynamic segment
 * is what makes those transport paths exist. Clients connect to `<basePath>/mcp`.
 */
import { createMcpHandler } from 'mcp-handler';
import { enforceWebRateLimit } from '@advance-labs/mcp-core';

import {
  buildGaGscContext,
  buildGaGscRuntime,
  registerGaGscTools,
  type GaGscRuntime,
} from '@/mcp/ga-gsc/server.js';
import { SERVER_NAME, SERVER_VERSION } from '@/mcp/ga-gsc/config.js';
import { bearerToken } from '@/mcp/ga-gsc/http-util.js';
import { getSharedMcpRateLimiter } from '@/mcp/shared.js';
import { checkEntitlement } from '@/lib/billing/entitlements';

export const runtime = 'nodejs';

/** Lazily-built process-shared runtime (token store + resolver). */
let cachedRuntime: GaGscRuntime | undefined;
function getRuntime(): GaGscRuntime {
  cachedRuntime ??= buildGaGscRuntime();
  return cachedRuntime;
}

/**
 * Build the per-request MCP handler bound to the caller's BYOK bearer token. The
 * token flows into the tool context (request-scoped, never persisted or logged)
 * and takes precedence over any stored Google credential.
 */
function buildHandler(requestToken: string | null): (req: Request) => Promise<Response> {
  const ctx = buildGaGscContext(getRuntime(), requestToken);
  return createMcpHandler(
    (server) => {
      registerGaGscTools(server, ctx);
    },
    {
      serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
    },
    {
      basePath: '/api/mcp/ga-gsc',
      maxDuration: 120,
      verboseLogs: process.env.NODE_ENV === 'development',
    },
  );
}

/** Gate via the distributed limiter, then dispatch to a bearer-bound MCP handler. */
async function handler(request: Request): Promise<Response> {
  const limited = await enforceWebRateLimit(getSharedMcpRateLimiter(), request);
  if (limited) return limited;

  // Entitlement gate (no-op when billing is dormant; gates MCP access to plans with mcpAccess).
  const gate = await checkEntitlement(request, 'mcp');
  if (!gate.ok) return Response.json(gate.body, { status: gate.status });

  const token = bearerToken(request.headers.get('authorization'));
  return buildHandler(token)(request);
}

export { handler as GET, handler as POST };
