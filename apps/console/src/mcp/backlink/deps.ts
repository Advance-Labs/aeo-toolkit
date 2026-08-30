/**
 * Dependency bundle threaded into every backlink tool factory.
 *
 * Keeping the `HttpClient` and `OutreachClient` injectable here is what makes the
 * whole tool layer unit-testable: tests build a registry with fake clients; the
 * real route builds one with the live clients. No tool reaches for `fetch` or
 * `@advance-labs/llm` directly.
 */
import type { HttpClient } from '@advance-labs/backlinks';
import type { OutreachClient } from './lib/outreach.js';

export interface ToolDeps {
  http: HttpClient;
  outreach: OutreachClient;
  /** Default max results for scraping tools; bounded so we stay polite. */
  maxResults: number;
  /**
   * CommonCrawl monthly index id the supplementary source queries against.
   * Optional so existing fixtures/tests can omit it; the tools fall back to the
   * adapter's `DEFAULT_CC_INDEX` when unset.
   */
  commonCrawlIndex?: string;
}
