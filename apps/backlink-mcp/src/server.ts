#!/usr/bin/env node
/**
 * stdio entrypoint — local integration (Claude Desktop, Cursor, etc.).
 *
 * Builds the shared tool registry and connects it over a stdio transport. All
 * diagnostics go to stderr so stdout stays a clean JSON-RPC channel.
 *
 * Run (after build):  node dist/server.js
 * Env:  BACKLINK_RATE_CAPACITY, BACKLINK_RATE_REFILL_PER_SEC,
 *       BACKLINK_USER_AGENT, BACKLINK_REQUEST_TIMEOUT_MS
 */
import { mountStdio } from '@aeo/mcp-core';
import { buildServer } from './registry.js';
import { SERVER_NAME, SERVER_VERSION } from './config.js';

async function main(): Promise<void> {
  const created = buildServer();
  await mountStdio(created);
  // stderr only — stdout is the JSON-RPC transport.
  process.stderr.write(`${SERVER_NAME} v${SERVER_VERSION} ready on stdio\n`);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`fatal: ${message}\n`);
  process.exitCode = 1;
});
