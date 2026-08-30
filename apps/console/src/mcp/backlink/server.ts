/**
 * Backlink MCP tool registry + dependency wiring.
 *
 * `registerBacklinkTools(server, deps)` binds every backlink tool's zod schema +
 * handler onto an `McpServer` (the object `mcp-handler`'s `createMcpHandler` setup
 * callback gives us) via `@advance-labs/mcp-core#registerTool`. `buildBacklinkDeps()`
 * assembles the live HTTP seam (rate-limited) + the `@advance-labs/llm`-backed outreach
 * client from the environment; tests inject fakes instead.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ZodRawShape } from 'zod';
import { registerTool, type McpToolDef } from '@advance-labs/mcp-core';
import { complete } from '@advance-labs/llm';
import { resolveRateLimiter } from '@advance-labs/storage';
import type { LlmCompletionRequest } from '@advance-labs/types';
import { createLiveHttpClient, createRateLimitedHttpClient, type HttpClient } from '@advance-labs/backlinks';

import { resolveConfig, type ServerConfig } from './config.js';
import type { OutreachClient } from './lib/outreach.js';
import type { ToolDeps } from './deps.js';
import { findMentionsTool } from './tools/find-mentions.js';
import { findProspectsTool } from './tools/find-prospects.js';
import { findCompetitorLinkSourcesTool } from './tools/find-competitor-link-sources.js';
import { verifyPageLinksTool } from './tools/verify-page-links.js';
import { extractContactInfoTool } from './tools/extract-contact-info.js';
import { checkPageHistoryTool } from './tools/check-page-history.js';
import { generateOutreachEmailTool } from './tools/generate-outreach-email.js';

export type { ToolDeps } from './deps.js';

/** Builds a tool from injected deps and registers it on an `McpServer`. */
type ToolRegistrar = (server: McpServer, deps: ToolDeps) => void;

/**
 * Wrap one tool factory in a registrar, capturing its concrete zod shape in
 * `TShape`. Each `registerTool` call is thus monomorphic (the shape is fixed at
 * this call site), and the returned thunk erases `TShape` to a uniform
 * `ToolRegistrar` so a heterogeneous set can live in one array.
 */
function toRegistrar<TShape extends ZodRawShape>(
  factory: (deps: ToolDeps) => McpToolDef<TShape>,
): ToolRegistrar {
  return (server, deps) => {
    registerTool(server, factory(deps));
  };
}

/** Every tool registrar, in registration order. */
const TOOL_REGISTRARS: readonly ToolRegistrar[] = [
  toRegistrar(findMentionsTool),
  toRegistrar(findProspectsTool),
  toRegistrar(findCompetitorLinkSourcesTool),
  toRegistrar(verifyPageLinksTool),
  toRegistrar(extractContactInfoTool),
  toRegistrar(checkPageHistoryTool),
  toRegistrar(generateOutreachEmailTool),
];

/** Register all seven backlink tools onto `server` with the supplied deps. */
export function registerBacklinkTools(server: McpServer, deps: ToolDeps): void {
  for (const register of TOOL_REGISTRARS) {
    register(server, deps);
  }
}

/** Live outreach client backed by `@advance-labs/llm.complete`. */
const liveOutreachClient: OutreachClient = {
  complete: (req: LlmCompletionRequest) => complete(req),
};

export interface BuildBacklinkDepsOptions {
  config?: ServerConfig;
  /** Override the HTTP seam (tests inject a fake; the route uses the live one). */
  http?: HttpClient;
  /** Override the LLM seam (tests inject a fake; the route uses `@advance-labs/llm`). */
  outreach?: OutreachClient;
}

/**
 * Build the live `ToolDeps` from the environment: an honest-UA HTTP client wrapped
 * with the configurable scrape limiter (`resolveRateLimiter` → Upstash when its
 * REST creds are present, in-memory otherwise) plus the `@advance-labs/llm` outreach client.
 * Tests pass `opts.http` / `opts.outreach` to bypass the live path entirely.
 */
export function buildBacklinkDeps(opts: BuildBacklinkDepsOptions = {}): ToolDeps {
  const config = opts.config ?? resolveConfig();

  let http: HttpClient;
  if (opts.http) {
    http = opts.http;
  } else {
    const live = createLiveHttpClient({
      userAgent: config.userAgent,
      requestTimeoutMs: config.requestTimeoutMs,
    });
    const limiter = resolveRateLimiter({
      limit: config.scrapeRateLimit.limit,
      windowSeconds: config.scrapeRateLimit.windowSeconds,
      ...(config.scrapeRateLimit.redisUrl !== undefined
        ? { redisUrl: config.scrapeRateLimit.redisUrl }
        : {}),
      ...(config.scrapeRateLimit.redisToken !== undefined
        ? { redisToken: config.scrapeRateLimit.redisToken }
        : {}),
    });
    http = createRateLimitedHttpClient(live, limiter);
  }

  return {
    http,
    outreach: opts.outreach ?? liveOutreachClient,
    maxResults: config.rateLimit.capacity,
    commonCrawlIndex: config.commonCrawlIndex,
  };
}
