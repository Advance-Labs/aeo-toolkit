/**
 * AI-visibility MCP tool registry.
 *
 * Wires each tool's zod input schema + handler onto an `McpServer` (the object
 * `mcp-handler`'s `createMcpHandler` setup callback hands us) via
 * `@advance-labs/mcp-core#registerTool`, which itself wraps each handler with structured
 * errors. Handlers call the pure logic in `logic.ts`, then shape the result into
 * an MCP `ToolResult` carrying both a human-readable text block and
 * machine-readable `structuredContent`.
 *
 * The dependency seam (`ToolDeps`) is injectable so tests register the tools
 * against a fake server with fake deps.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerTool, type ToolResult } from '@advance-labs/mcp-core';

import { defaultDeps, type ToolDeps } from './deps.js';
import {
  analyzeWebsiteAeo,
  checkAiVisibility,
  compareCompetitorVisibility,
  discoverRankingPrompts,
  getVisibilityReport,
} from './logic.js';

/** Shape a JSON-serialisable value into a success `ToolResult`. */
function ok(summaryText: string, structured: Record<string, unknown>): ToolResult {
  return {
    content: [{ type: 'text', text: summaryText }],
    structuredContent: structured,
  };
}

const urlSchema = z.string().url();
const perplexityKeySchema = z
  .string()
  .min(1)
  .describe('Your Perplexity API key (BYOK). Request-scoped; never stored or logged.');

/**
 * Register all five visibility tools onto `server`. `deps` defaults to the real
 * `@advance-labs/*` functions; tests pass a fake `ToolDeps`.
 */
export function registerAiVisibilityTools(server: McpServer, deps: ToolDeps = defaultDeps): void {
  registerTool(server, {
    name: 'analyze_website_aeo',
    title: 'Analyze website AEO',
    description:
      'Crawl a URL, parse its HTML and structured data, and score it for answer-engine ' +
      'optimization (AEO). Returns an AEO-focused summary, AI-bot access, and crawl-hint files.',
    inputSchema: { url: urlSchema },
    handler: async ({ url }) => {
      const result = await analyzeWebsiteAeo(deps, { url });
      const s = result.summary;
      const text =
        `AEO analysis for ${url}\n` +
        `Overall: ${s.overall}/100 (grade ${s.grade}) · AEO category: ${s.aeoCategoryScore ?? 'n/a'}\n` +
        `Pages crawled: ${result.pagesCrawled} · Critical issues: ${s.criticalCount}\n` +
        `Top fixes: ${s.topFixes.map((f) => f.title).join('; ') || 'none'}`;
      return ok(text, result as unknown as Record<string, unknown>);
    },
  });

  registerTool(server, {
    name: 'check_ai_visibility',
    title: 'Check AI visibility',
    description:
      'Query Perplexity Sonar with a prompt and inspect its citations to determine whether the ' +
      'given URL is cited as a source, and at what rank.',
    inputSchema: {
      prompt: z.string().min(1).describe('The end-user question to test.'),
      url: urlSchema.describe('The site URL to check for citations.'),
      perplexityApiKey: perplexityKeySchema,
    },
    handler: async ({ prompt, url, perplexityApiKey }) => {
      const check = await checkAiVisibility(deps, { prompt, url, perplexityApiKey });
      const text = check.cited
        ? `${url} IS cited for "${prompt}" (rank ${check.citationRank}, ${check.citations.length} total sources, model ${check.model}).`
        : `${url} is NOT cited for "${prompt}" (${check.citations.length} sources returned, model ${check.model}).`;
      return ok(text, check as unknown as Record<string, unknown>);
    },
  });

  registerTool(server, {
    name: 'discover_ranking_prompts',
    title: 'Discover ranking prompts',
    description:
      'Generate realistic user prompts a site should aim to be cited for on a topic, using ' +
      'Perplexity Sonar. Optionally tests a few of them for live visibility.',
    inputSchema: {
      url: urlSchema,
      topic: z.string().min(1).describe('The topic / niche to generate prompts for.'),
      perplexityApiKey: perplexityKeySchema,
      testCount: z
        .number()
        .int()
        .min(0)
        .max(10)
        .optional()
        .describe('How many generated prompts to live-test (default 3).'),
    },
    handler: async ({ url, topic, perplexityApiKey, testCount }) => {
      const result = await discoverRankingPrompts(deps, {
        url,
        topic,
        perplexityApiKey,
        ...(testCount !== undefined ? { testCount } : {}),
      });
      const citedTested = result.tested.filter((t) => t.cited).length;
      const text =
        `Generated ${result.candidates.length} candidate prompts for "${topic}".\n` +
        (result.tested.length > 0
          ? `Tested ${result.tested.length}; ${url} cited in ${citedTested}.`
          : 'No prompts were live-tested.');
      return ok(text, result as unknown as Record<string, unknown>);
    },
  });

  registerTool(server, {
    name: 'get_visibility_report',
    title: 'Get visibility report',
    description:
      'Combine an AEO audit of a URL with per-prompt AI-visibility checks into a single report ' +
      'with an overall citation rate.',
    inputSchema: {
      url: urlSchema,
      prompts: z.array(z.string().min(1)).min(1).describe('Prompts to test for visibility.'),
      perplexityApiKey: perplexityKeySchema,
    },
    handler: async ({ url, prompts, perplexityApiKey }) => {
      const report = await getVisibilityReport(deps, { url, prompts, perplexityApiKey });
      const v = report.visibility;
      const text =
        `Visibility report for ${url}\n` +
        `AEO overall: ${report.aeo.summary.overall}/100 (grade ${report.aeo.summary.grade})\n` +
        `Cited in ${v.citedCount}/${v.totalPrompts} prompts (${Math.round(v.citationRate * 100)}%).`;
      return ok(text, report as unknown as Record<string, unknown>);
    },
  });

  registerTool(server, {
    name: 'compare_competitor_visibility',
    title: 'Compare competitor visibility',
    description:
      'Run one Perplexity Sonar query and rank several competitor URLs by whether and where ' +
      'each is cited for the prompt.',
    inputSchema: {
      prompt: z.string().min(1),
      urls: z.array(urlSchema).min(2).describe('Two or more competitor URLs to rank.'),
      perplexityApiKey: perplexityKeySchema,
    },
    handler: async ({ prompt, urls, perplexityApiKey }) => {
      const result = await compareCompetitorVisibility(deps, { prompt, urls, perplexityApiKey });
      const ranked = result.results
        .map((r, i) => `${i + 1}. ${r.url}${r.cited ? ` (cited, rank ${r.rank})` : ' (not cited)'}`)
        .join('\n');
      const text = `Competitor visibility for "${prompt}":\n${ranked}`;
      return ok(text, result as unknown as Record<string, unknown>);
    },
  });
}
