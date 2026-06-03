/**
 * Dependency seam for the tool handlers.
 *
 * Tools take a `ToolDeps` object instead of importing `@aeo/crawler` / `@aeo/llm`
 * directly, so unit tests can inject fakes without touching the network. The
 * production wiring (`defaultDeps`) binds the real package functions.
 */
import { crawl as realCrawl } from '@aeo/crawler';
import { parseHtml as realParseHtml } from '@aeo/html-parser';
import { analyzeStructuredData as realAnalyzeStructuredData } from '@aeo/schema-validator';
import { complete as realComplete } from '@aeo/llm';
import type { CrawlResult, ParsedHtml, StructuredDataReport } from '@aeo/types';
import type { LlmCompletionRequest, LlmCompletionResponse } from '@aeo/types';
import type { CrawlRuntimeOptions } from '@aeo/crawler';

/** Crawl a URL into a `CrawlResult`. Mirrors `@aeo/crawler#crawl`. */
export type CrawlFn = (url: string, opts: CrawlRuntimeOptions) => Promise<CrawlResult>;

/** Parse one HTML string into `ParsedHtml`. Mirrors `@aeo/html-parser#parseHtml`. */
export type ParseHtmlFn = (html: string, url: string) => ParsedHtml;

/** Analyze structured data from raw HTML. Mirrors `@aeo/schema-validator#analyzeStructuredData`. */
export type AnalyzeStructuredDataFn = (html: string, url: string) => StructuredDataReport;

/** Run one LLM completion. Mirrors `@aeo/llm#complete`. */
export type CompleteFn = (req: LlmCompletionRequest) => Promise<LlmCompletionResponse>;

export interface ToolDeps {
  crawl: CrawlFn;
  parseHtml: ParseHtmlFn;
  analyzeStructuredData: AnalyzeStructuredDataFn;
  complete: CompleteFn;
}

/** Production dependencies bound to the real `@aeo/*` package functions. */
export const defaultDeps: ToolDeps = {
  crawl: realCrawl,
  parseHtml: realParseHtml,
  analyzeStructuredData: realAnalyzeStructuredData,
  complete: (req) => realComplete(req),
};
