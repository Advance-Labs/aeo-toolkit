/**
 * Compatibility alias. The server moved to `/api/mcp/search` when Bing joined
 * Google behind one server; this path stays so MCP client configs pinned to
 * `/api/mcp/ga-gsc/mcp` keep working.
 *
 * The handler is NOT re-exported from the new route module: `mcp-handler`
 * derives its transport endpoints from `basePath` and compares them against the
 * request pathname, so a handler built with basePath '/api/mcp/search' answers
 * "Not found" to every request arriving here. This file therefore builds its own
 * handler at its own basePath over the same tools.
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

let cachedRuntime: GaGscRuntime | undefined;
function getRuntime(): GaGscRuntime {
  cachedRuntime ??= buildGaGscRuntime();
  return cachedRuntime;
}

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
    { serverInfo: { name: SERVER_NAME, version: SERVER_VERSION } },
    {
      basePath: '/api/mcp/ga-gsc',
      maxDuration: 120,
      verboseLogs: process.env.NODE_ENV === 'development',
    },
  );
}

async function handler(request: Request): Promise<Response> {
  const limited = await enforceWebRateLimit(getSharedMcpRateLimiter(), request);
  if (limited) return limited;

  const gate = await checkEntitlement(request, 'mcp');
  if (!gate.ok) return Response.json(gate.body, { status: gate.status });

  const auth = authenticateSearchRequest(request, '/api/mcp/ga-gsc/mcp');
  if (!auth.ok) return auth.response;
  return buildHandler(auth.caller)(request);
}

export { handler as GET, handler as POST };
