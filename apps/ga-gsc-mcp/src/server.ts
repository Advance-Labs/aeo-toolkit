/**
 * Local entry: GA4 + GSC MCP server over a stdio transport (Claude Desktop / CLI).
 *
 * Builds one server, wires the shared tool registry against a single-user context
 * (token resolved from the InMemoryTokenStore + GOOGLE_ACCESS_TOKEN for local dev),
 * and connects stdio. The hosted HTTP/SSE variant lives in `http.ts` and reuses the
 * same `registerAllTools` so both transports expose an identical tool surface.
 */
import { createServer } from '@aeo/mcp-core';

import { loadConfig } from './config.js';
import { createDefaultTokenResolver } from './auth.js';
import { baseContext, defaultClientFactory, registerAllTools } from './tools/index.js';

const VERSION = '0.1.0';

/** Build the stdio server + its single-user tool context from env config. */
export function buildStdioServer(env: NodeJS.ProcessEnv = process.env) {
  const config = loadConfig(env);
  const tokens = createDefaultTokenResolver({
    oauthEnv: config.oauth,
    staticAccessToken: config.staticAccessToken,
  });
  const created = createServer({
    name: 'ga-gsc-mcp',
    version: VERSION,
    rateLimit: config.rateLimit,
  });
  registerAllTools(created, baseContext(tokens, defaultClientFactory));
  return created;
}

/** Connect the server over stdio. Logs go to stderr so stdout stays JSON-RPC clean. */
export async function main(): Promise<void> {
  const created = buildStdioServer();
  // Import lazily so unit tests that call buildStdioServer don't touch the transport.
  const { mountStdio } = await import('@aeo/mcp-core');
  await mountStdio(created);
  process.stderr.write('[ga-gsc-mcp] stdio transport ready\n');
}

// Run only when executed directly (not when imported by tests).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err: unknown) => {
    process.stderr.write(`[ga-gsc-mcp] fatal: ${String(err)}\n`);
    process.exitCode = 1;
  });
}
