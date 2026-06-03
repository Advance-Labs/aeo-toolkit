/**
 * Tool logic — the dependency-injected, transport-agnostic core of each tool.
 *
 * Every function here takes a `ToolDeps` (so tests inject fakes) and returns a
 * plain, JSON-serialisable result object. The MCP wrapping (zod schema, content
 * blocks, structured errors) lives in `index.ts`; these functions are pure of
 * the SDK and fully unit-testable.
 */
import { auditScore } from '@aeo/scoring';
import { McpToolError } from '@aeo/mcp-core';
import type {
  CompetitorVisibility,
  CrawledPage,
  CrawlResult,
  ParsedHtml,
  ScoringContext,
  StructuredDataReport,
  VisibilityCheck,
} from '@aeo/types';

import type { ToolDeps } from '../deps.js';
import {
  AEO_MAX_PAGES,
  CRAWL_PER_HOST_RATE_LIMIT_MS,
  DEFAULT_DISCOVER_TEST_COUNT,
  DISCOVERY_MODEL,
  PERPLEXITY_MODEL,
  PERPLEXITY_PROVIDER,
} from '../config.js';
import {
  buildCompetitorVisibility,
  buildVisibilityCheck,
  parsePromptList,
  summarizeAeo,
  type AeoSummary,
} from './shared.js';

/** Build a single-URL `ScoringContext` from a crawl by parsing each HTML page. */
function toScoringContext(deps: ToolDeps, crawl: CrawlResult): ScoringContext {
  const htmlPages = crawl.pages.filter(
    (p): p is CrawledPage & { body: string } => p.ok && typeof p.body === 'string',
  );

  const pages: ParsedHtml[] = htmlPages.map((p) => deps.parseHtml(p.body, p.finalUrl));
  const structuredData: StructuredDataReport[] = htmlPages.map((p) =>
    deps.analyzeStructuredData(p.body, p.finalUrl),
  );

  return {
    crawl,
    pages,
    structuredData,
    mode: crawl.pageCount <= 1 ? 'single-page' : 'full-site',
  };
}

export interface AnalyzeWebsiteAeoResult {
  summary: AeoSummary;
  pagesCrawled: number;
  /** Which AI crawlers are allowed at the root (AEO gating signal). */
  aiBotsAllowed: Array<{ bot: string; allowed: boolean }>;
  /** Crawl-hint / trust file presence (llms.txt etc.). */
  filePresence: CrawlResult['filePresence'];
}

/**
 * `analyze_website_aeo` — crawl + parse + schema-detect → `auditScore` → an
 * AEO-focused summary plus the AI-bot access and crawl-hint signals.
 */
export async function analyzeWebsiteAeo(
  deps: ToolDeps,
  args: { url: string },
): Promise<AnalyzeWebsiteAeoResult> {
  const crawl = await deps.crawl(args.url, {
    maxPages: AEO_MAX_PAGES,
    perHostRateLimitMs: CRAWL_PER_HOST_RATE_LIMIT_MS,
    respectRobotsTxt: true,
  });

  if (crawl.pageCount === 0) {
    throw new McpToolError(
      `No pages could be fetched from "${args.url}". The site may be unreachable or blocking crawlers.`,
      'crawl_empty',
    );
  }

  const ctx = toScoringContext(deps, crawl);
  const score = await auditScore(ctx);
  const summary = summarizeAeo(args.url, score);

  return {
    summary,
    pagesCrawled: crawl.pageCount,
    aiBotsAllowed: crawl.robots.aiBotDirectives.map((d) => ({ bot: d.bot, allowed: d.allowed })),
    filePresence: crawl.filePresence,
  };
}

/**
 * `check_ai_visibility` — ask Perplexity Sonar the prompt, then inspect the
 * returned citations to see whether (and where) `url` is cited.
 */
export async function checkAiVisibility(
  deps: ToolDeps,
  args: { prompt: string; url: string; perplexityApiKey: string },
): Promise<VisibilityCheck> {
  const res = await deps.complete({
    provider: PERPLEXITY_PROVIDER,
    model: PERPLEXITY_MODEL,
    apiKey: args.perplexityApiKey,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content:
          'You are an AI search engine. Answer the user query concisely and cite your sources.',
      },
      { role: 'user', content: args.prompt },
    ],
  });

  return buildVisibilityCheck(
    args.prompt,
    args.url,
    res.model || PERPLEXITY_MODEL,
    res.citations ?? [],
  );
}

export interface DiscoverRankingPromptsResult {
  url: string;
  topic: string;
  /** All generated candidate prompts. */
  candidates: string[];
  /** The subset that was tested via a live visibility check (when a key is given). */
  tested: VisibilityCheck[];
}

/**
 * `discover_ranking_prompts` — use Perplexity Sonar to generate candidate user
 * prompts a site like `url` should aim to rank for on `topic`. When a
 * `perplexityApiKey` is supplied, a few are immediately tested for visibility.
 */
export async function discoverRankingPrompts(
  deps: ToolDeps,
  args: { url: string; topic: string; perplexityApiKey?: string; testCount?: number },
): Promise<DiscoverRankingPromptsResult> {
  const res = await deps.complete({
    provider: PERPLEXITY_PROVIDER,
    model: DISCOVERY_MODEL,
    apiKey: requireGenerationKey(args.perplexityApiKey),
    temperature: 0.4,
    messages: [
      {
        role: 'system',
        content:
          'You generate realistic end-user search queries for answer-engine optimization. ' +
          'Return ONE query per line, no numbering, no commentary.',
      },
      {
        role: 'user',
        content:
          `Generate 10 natural-language questions that potential customers would ask an AI ` +
          `assistant about "${args.topic}", for which the website ${args.url} would ideally be ` +
          `cited as a source. Vary intent (informational, comparison, how-to, buying).`,
      },
    ],
  });

  const candidates = parsePromptList(res.text, 10);

  const tested: VisibilityCheck[] = [];
  if (args.perplexityApiKey) {
    const n = Math.min(args.testCount ?? DEFAULT_DISCOVER_TEST_COUNT, candidates.length);
    for (let i = 0; i < n; i += 1) {
      const prompt = candidates[i];
      if (prompt === undefined) continue;
      tested.push(
        await checkAiVisibility(deps, {
          prompt,
          url: args.url,
          perplexityApiKey: args.perplexityApiKey,
        }),
      );
    }
  }

  return { url: args.url, topic: args.topic, candidates, tested };
}

export interface VisibilityReport {
  url: string;
  aeo: AnalyzeWebsiteAeoResult;
  visibility: {
    checks: VisibilityCheck[];
    citedCount: number;
    totalPrompts: number;
    /** Fraction of tested prompts where the URL was cited, 0..1. */
    citationRate: number;
  };
}

/**
 * `get_visibility_report` — combine the AEO audit with per-prompt visibility
 * checks into a single report. AEO and visibility run independently so a crawl
 * failure does not lose the visibility data (and vice versa) — both are awaited.
 */
export async function getVisibilityReport(
  deps: ToolDeps,
  args: { url: string; prompts: string[]; perplexityApiKey: string },
): Promise<VisibilityReport> {
  if (args.prompts.length === 0) {
    throw new McpToolError('`prompts` must contain at least one prompt.', 'no_prompts');
  }

  const aeo = await analyzeWebsiteAeo(deps, { url: args.url });

  const checks: VisibilityCheck[] = [];
  for (const prompt of args.prompts) {
    checks.push(
      await checkAiVisibility(deps, {
        prompt,
        url: args.url,
        perplexityApiKey: args.perplexityApiKey,
      }),
    );
  }

  const citedCount = checks.filter((c) => c.cited).length;
  return {
    url: args.url,
    aeo,
    visibility: {
      checks,
      citedCount,
      totalPrompts: checks.length,
      citationRate: checks.length === 0 ? 0 : citedCount / checks.length,
    },
  };
}

/**
 * `compare_competitor_visibility` — run `check_ai_visibility` across several
 * URLs for one prompt and return a ranked `CompetitorVisibility`. The single
 * Perplexity answer is reused across URLs (one prompt → one answer → many URL
 * matches) so the comparison is consistent and cost-efficient.
 */
export async function compareCompetitorVisibility(
  deps: ToolDeps,
  args: { prompt: string; urls: string[]; perplexityApiKey: string },
): Promise<CompetitorVisibility> {
  if (args.urls.length < 2) {
    throw new McpToolError('`urls` must contain at least two URLs to compare.', 'too_few_urls');
  }

  // One Sonar call; its citations are matched against every competitor URL.
  const res = await deps.complete({
    provider: PERPLEXITY_PROVIDER,
    model: PERPLEXITY_MODEL,
    apiKey: args.perplexityApiKey,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content:
          'You are an AI search engine. Answer the user query concisely and cite your sources.',
      },
      { role: 'user', content: args.prompt },
    ],
  });

  const citations = res.citations ?? [];
  const model = res.model || PERPLEXITY_MODEL;
  const checks = args.urls.map((url) => buildVisibilityCheck(args.prompt, url, model, citations));

  return buildCompetitorVisibility(args.prompt, checks);
}

/**
 * Generation steps (prompt discovery) still need a Perplexity key. We reuse the
 * caller's BYOK key; if absent we cannot generate, so fail clearly.
 */
function requireGenerationKey(key: string | undefined): string {
  if (!key || key.length === 0) {
    throw new McpToolError(
      'discover_ranking_prompts requires `perplexityApiKey` to generate candidate prompts (BYOK).',
      'missing_api_key',
    );
  }
  return key;
}
