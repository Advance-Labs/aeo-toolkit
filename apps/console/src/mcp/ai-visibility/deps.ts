/**
 * Dependency seam for the ai-visibility tool handlers.
 *
 * Tools take a `ToolDeps` object instead of importing `@advance-labs/crawler` / `@advance-labs/llm`
 * directly, so unit tests can inject fakes without touching the network. The
 * production wiring (`defaultDeps`) binds the real package functions.
 */
import { crawl as realCrawl } from '@advance-labs/crawler';
import { parseHtml as realParseHtml } from '@advance-labs/html-parser';
import { analyzeStructuredData as realAnalyzeStructuredData } from '@advance-labs/schema-validator';
import { complete as realComplete } from '@advance-labs/llm';
import type { CrawlResult, ParsedHtml, StructuredDataReport } from '@advance-labs/types';
import type { LlmCompletionRequest, LlmCompletionResponse } from '@advance-labs/types';
import type { CrawlRuntimeOptions } from '@advance-labs/crawler';

/** Crawl a URL into a `CrawlResult`. Mirrors `@advance-labs/crawler#crawl`. */
export type CrawlFn = (url: string, opts: CrawlRuntimeOptions) => Promise<CrawlResult>;

/** Parse one HTML string into `ParsedHtml`. Mirrors `@advance-labs/html-parser#parseHtml`. */
export type ParseHtmlFn = (html: string, url: string) => ParsedHtml;

/** Analyze structured data from raw HTML. Mirrors `@advance-labs/schema-validator#analyzeStructuredData`. */
export type AnalyzeStructuredDataFn = (html: string, url: string) => StructuredDataReport;

/** Run one LLM completion. Mirrors `@advance-labs/llm#complete`. */
export type CompleteFn = (req: LlmCompletionRequest) => Promise<LlmCompletionResponse>;

export interface ToolDeps {
  crawl: CrawlFn;
  parseHtml: ParseHtmlFn;
  analyzeStructuredData: AnalyzeStructuredDataFn;
  complete: CompleteFn;
}

/** Production dependencies bound to the real `@advance-labs/*` package functions. */
export const defaultDeps: ToolDeps = {
  crawl: realCrawl,
  parseHtml: realParseHtml,
  analyzeStructuredData: realAnalyzeStructuredData,
  complete: (req) => realComplete(req),
};
