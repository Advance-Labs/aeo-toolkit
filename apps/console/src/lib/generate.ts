/**
 * Orchestrator: URL → crawl → manifest → rendered llms.txt (+ optional full).
 *
 * The crawl function is injected (defaulting to `@aeo/crawler`'s `crawl`) so the
 * whole pipeline can be unit-tested with a fake CrawlResult and zero network.
 */
import type { CrawlResult, Url } from '@aeo/types';
import { crawl as defaultCrawl } from '@aeo/crawler';
import type { CrawlRuntimeOptions } from '@aeo/crawler';
import { buildManifest } from './manifest.js';
import { renderLlmsFullTxt, renderLlmsTxt } from './render.js';
import type { GenerateResponse } from './generate-types.js';

/** The single network seam — matches `@aeo/crawler`'s `crawl` signature. */
export type CrawlFn = (rootUrl: Url, opts: CrawlRuntimeOptions) => Promise<CrawlResult>;

export interface GenerateOptions {
  full?: boolean;
  /** Hard cap on pages crawled. Defaults to 50 per the audit-pipeline convention. */
  maxPages?: number;
  /** Injectable crawler (default `@aeo/crawler`); tests pass a fake. */
  crawl?: CrawlFn;
}

const DEFAULT_MAX_PAGES = 50;

/**
 * Run the full generation pipeline for a normalized absolute URL. Returns the
 * rendered files plus the structured manifest and the contributing page count.
 */
export async function generateLlmsTxt(
  url: string,
  options: GenerateOptions = {},
): Promise<GenerateResponse> {
  const crawlFn = options.crawl ?? (defaultCrawl as CrawlFn);
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;

  const crawlResult = await crawlFn(url, {
    maxPages,
    respectRobotsTxt: true,
    followSitemap: true,
  });

  const { manifest, pages } = buildManifest(crawlResult);

  const llmsTxt = renderLlmsTxt(manifest);
  const response: GenerateResponse = {
    llmsTxt,
    manifest,
    pageCount: pages.length,
    url: crawlResult.rootUrl,
  };

  if (options.full) {
    response.llmsFullTxt = renderLlmsFullTxt(manifest, pages);
  }

  return response;
}
