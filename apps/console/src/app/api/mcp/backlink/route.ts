/**
 * Backlink MCP server, mounted as a Next.js App Router route handler.
 *
 * Built from the re-homed tool registry in `@/mcp/backlink/server` via the Vercel
 * `mcp-handler` adapter. A per-caller distributed rate-limit gate runs before the
 * transport hand-off (reusing `@aeo/storage`'s limiter via `@/mcp/shared`); a
 * second, finer scrape limiter inside the live HTTP client throttles outbound GETs
 * to the free sources (DuckDuckGo, Wayback, CommonCrawl).
 *
 * BYOK: `generate_outreach_email` takes the LLM API key as a request-scoped tool
 * argument — keys are never read from the environment, persisted, or logged.
 *
 * Node runtime: the tools scrape pages and call upstream APIs over the network.
 */
import { createMcpHandler } from 'mcp-handler';
import { enforceWebRateLimit } from '@aeo/mcp-core';

import { buildBacklinkDeps, registerBacklinkTools } from '@/mcp/backlink/server.js';
import { SERVER_NAME, SERVER_VERSION } from '@/mcp/backlink/config.js';
import { getSharedMcpRateLimiter } from '@/mcp/shared.js';

export const runtime = 'nodejs';

const deps = buildBacklinkDeps();

const mcpHandler = createMcpHandler(
  (server) => {
    registerBacklinkTools(server, deps);
  },
  {
    serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
  },
  {
    basePath: '/api/mcp/backlink',
    maxDuration: 120,
    verboseLogs: process.env.NODE_ENV === 'development',
  },
);

/** Gate every request through the per-caller distributed limiter, then the MCP transport. */
async function handler(request: Request): Promise<Response> {
  const limited = await enforceWebRateLimit(getSharedMcpRateLimiter(), request);
  if (limited) return limited;
  return mcpHandler(request);
}

export { handler as GET, handler as POST };
