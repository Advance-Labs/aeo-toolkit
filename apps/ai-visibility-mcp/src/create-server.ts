/**
 * Shared server factory used by BOTH transports (stdio + HTTP) so the tool
 * registry is defined exactly once.
 */
import { createServer, type CreatedServer } from '@aeo/mcp-core';

import { RATE_LIMIT, SERVER_NAME, SERVER_VERSION } from './config.js';
import { defaultDeps, type ToolDeps } from './deps.js';
import { registerAllTools } from './tools/index.js';

/**
 * Build a fully-configured AI-visibility MCP server (rate-limited) with all five
 * tools registered. `deps` is injectable for tests; production uses `defaultDeps`.
 */
export function buildAiVisibilityServer(deps: ToolDeps = defaultDeps): CreatedServer {
  const created = createServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
    rateLimit: { capacity: RATE_LIMIT.capacity, refillPerSec: RATE_LIMIT.refillPerSec },
  });
  registerAllTools(created, deps);
  return created;
}
