/**
 * AI-visibility MCP server, mounted as a Next.js App Router route handler.
 *
 * Built from the re-homed tool registry in `@/mcp/ai-visibility/server` via the
 * Vercel `mcp-handler` adapter, which exposes the MCP Streamable-HTTP transport
 * as GET/POST handlers. A per-caller distributed rate-limit gate runs before the
 * transport hand-off (reusing `@advance-labs/storage`'s limiter via `@/mcp/shared`).
 *
 * BYOK: every tool that calls Perplexity takes the API key as a request-scoped
 * tool argument — keys are never read from the environment, persisted, or logged.
 *
 * Node runtime: the tools crawl sites and call upstream APIs over the network.
 */
import { createMcpHandler } from 'mcp-handler';
import { enforceWebRateLimit } from '@advance-labs/mcp-core';

import { registerAiVisibilityTools } from '@/mcp/ai-visibility/server.js';
import { SERVER_NAME, SERVER_VERSION } from '@/mcp/ai-visibility/config.js';
import { getSharedMcpRateLimiter } from '@/mcp/shared.js';
import { checkEntitlement } from '@/lib/billing/entitlements';

export const runtime = 'nodejs';

const mcpHandler = createMcpHandler(
  (server) => {
    registerAiVisibilityTools(server);
  },
  {
    serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
  },
  {
    basePath: '/api/mcp/ai-visibility',
    maxDuration: 120,
    verboseLogs: process.env.NODE_ENV === 'development',
  },
);

/** Gate every request through the per-caller distributed limiter, then the MCP transport. */
async function handler(request: Request): Promise<Response> {
  const limited = await enforceWebRateLimit(getSharedMcpRateLimiter(), request);
  if (limited) return limited;
  // Entitlement gate (no-op when billing is dormant; gates MCP access to plans with mcpAccess).
  const gate = await checkEntitlement(request, 'mcp');
  if (!gate.ok) return Response.json(gate.body, { status: gate.status });
  return mcpHandler(request);
}

export { handler as GET, handler as POST };
