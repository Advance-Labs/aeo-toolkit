/**
 * Server + tool registry assembly.
 *
 * One function builds the rate-limited `CreatedServer` and registers every tool
 * against an injected `ToolDeps`. Both entrypoints (`server.ts` stdio, `http.ts`
 * HTTP/SSE) and the tests call this, so the tool surface is identical everywhere.
 */
import { createServer, type CreatedServer } from '@aeo/mcp-core';
import { complete } from '@aeo/llm';
import type { LlmCompletionRequest } from '@aeo/types';

import { resolveConfig, type ServerConfig } from './config.js';
import { createLiveHttpClient, type HttpClient } from './lib/http.js';
import type { OutreachClient } from './lib/outreach.js';
import { TOOL_REGISTRARS, type ToolDeps } from './tools/index.js';

export interface BuildOptions {
  config?: ServerConfig;
  /** Override the HTTP seam (tests inject a fake; entrypoints use the live one). */
  http?: HttpClient;
  /** Override the LLM seam (tests inject a fake; entrypoints use `@aeo/llm`). */
  outreach?: OutreachClient;
}

/** Live outreach client backed by `@aeo/llm.complete`. */
const liveOutreachClient: OutreachClient = {
  complete: (req: LlmCompletionRequest) => complete(req),
};

/**
 * Build the rate-limited server with all backlink tools registered.
 * Returns the `CreatedServer` so the caller can mount a transport.
 */
export function buildServer(opts: BuildOptions = {}): CreatedServer {
  const config = opts.config ?? resolveConfig();
  const created = createServer({
    name: config.name,
    version: config.version,
    rateLimit: config.rateLimit,
  });

  const deps: ToolDeps = {
    http:
      opts.http ??
      createLiveHttpClient({
        userAgent: config.userAgent,
        requestTimeoutMs: config.requestTimeoutMs,
      }),
    outreach: opts.outreach ?? liveOutreachClient,
    maxResults: config.rateLimit.capacity,
  };

  // Each registrar captures its own tool's concrete zod shape at definition time
  // (see `tools/index.ts`), so the collection is uniformly typed and every
  // `registerTool` call stays monomorphic — no heterogeneous-schema union to unify.
  for (const register of TOOL_REGISTRARS) {
    register(created, deps);
  }

  return created;
}
