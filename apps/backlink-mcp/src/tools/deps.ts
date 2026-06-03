/**
 * Dependency bundle threaded into every tool factory.
 *
 * Keeping the `HttpClient` and `OutreachClient` injectable here is what makes the
 * whole tool layer unit-testable: tests build a registry with fake clients; the
 * real entrypoints build one with the live clients. No tool reaches for `fetch`
 * or `@aeo/llm` directly.
 */
import type { HttpClient } from '../lib/http.js';
import type { OutreachClient } from '../lib/outreach.js';

export interface ToolDeps {
  http: HttpClient;
  outreach: OutreachClient;
  /** Default max results for scraping tools; bounded so we stay polite. */
  maxResults: number;
}
