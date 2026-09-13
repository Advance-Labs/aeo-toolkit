/**
 * Cross-engine search MCP server (Google Search Console + Bing Webmaster Tools),
 * mounted as a Next.js App Router route handler.
 *
 * Unlike the other two servers, this one takes TWO request-scoped BYOK credentials:
 * the `Authorization` bearer token (a Google access token) and the `x-bing-api-key`
 * header (a Bing Webmaster API key). Both are read per request, so the
 * `mcp-handler` handler is built *inside* the request function — this captures them
 * and injects them into a fresh tool context (the dynamic-routing shape from the
 * mcp-handler docs). Either may be absent: the Google tools and the Bing tools fail
 * independently, and a caller supplying only one still gets that engine's tools.
 * The process-shared runtime (env-gated Supabase/in-memory token store, Google
 * token resolver, Bing key resolver) is reused across requests.
 *
 * Or the caller logs in: an MCP client with no credentials gets a 401 challenge and
 * runs the OAuth flow under `/api/mcp/oauth`, then sends an `aeo_at_` token that
 * resolves to its own stored Google connection. `authenticateSearchRequest` sorts
 * the three cases out; see `@/mcp/oauth/gate`.
 *
 * A per-caller distributed rate-limit gate runs before the transport hand-off.
 *
 * Node runtime: the tools call the Google Analytics, Search Console, and Bing
 * Webmaster APIs.
 *
 * ROUTE SHAPE: this file MUST live under a `[transport]` segment. `mcp-handler`
 * derives its endpoints from `basePath` as `${basePath}/mcp`, `${basePath}/sse` and
 * `${basePath}/message`, then compares the request pathname against them. Mounted
 * directly at the basePath it answers every request with its own plain-text
 * "Not found" — a 404 that looks like a routing bug and is not. The dynamic segment
 * is what makes those transport paths exist. Clients connect to `<basePath>/mcp`.
 *
 * The previous path `/api/mcp/ga-gsc` still serves these same tools via its own
 * handler; see that route's docblock for why it cannot re-export this one.
 */
import { createMcpHandler } from 'mcp-handler';
import { enforceWebRateLimit } from '@advance-labs/mcp-core';

import {
  buildGaGscContext,
  buildGaGscRuntime,
  registerGaGscTools,
  type GaGscRuntime,
} from '@/mcp/search/server.js';
import { SERVER_NAME, SERVER_VERSION } from '@/mcp/search/config.js';
import { authenticateSearchRequest, type SearchCaller } from '@/mcp/oauth/gate.js';
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
 * Build the per-request MCP handler bound to the caller's credentials. A BYOK
 * token flows into the tool context (request-scoped, never persisted or logged)
 * and takes precedence over any stored Google credential; an OAuth caller brings
 * its own `userId` instead.
 */
function buildHandler(caller: SearchCaller): (req: Request) => Promise<Response> {
  const ctx = buildGaGscContext(
    getRuntime(),
    caller.requestToken,
    caller.requestBingKey,
    caller.userId,
  );
  return createMcpHandler(
    (server) => {
      registerGaGscTools(server, ctx);
    },
    {
      serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
    },
    {
      basePath: '/api/mcp/search',
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

  const auth = authenticateSearchRequest(request, '/api/mcp/search/mcp');
  if (!auth.ok) return auth.response;
  return buildHandler(auth.caller)(request);
}

export { handler as GET, handler as POST };
