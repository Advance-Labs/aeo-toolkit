#!/usr/bin/env node
/**
 * Local stdio entry — for Claude Desktop / Cursor / any local MCP client.
 *
 * Connects the shared server (same tool registry as the hosted HTTP entry) over
 * a stdio transport. BYOK Perplexity keys arrive per tool call; nothing is read
 * from the environment for the visibility tools.
 *
 * Run: `node dist/server.js` (or via the `ai-visibility-mcp` bin).
 */
import { mountStdio } from '@aeo/mcp-core';

import { buildAiVisibilityServer } from './create-server.js';

async function main(): Promise<void> {
  const created = buildAiVisibilityServer();
  await mountStdio(created);
  // Logging to stdout would corrupt the stdio JSON-RPC stream; use stderr only.
  process.stderr.write('ai-visibility-mcp: stdio transport ready\n');
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`ai-visibility-mcp: fatal: ${message}\n`);
  process.exitCode = 1;
});
