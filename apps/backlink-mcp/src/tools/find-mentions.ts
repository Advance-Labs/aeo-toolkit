/**
 * `find_mentions` — discover linked and unlinked brand mentions.
 *
 * Runs a DuckDuckGo HTML search for the brand and, when a `domain` is given,
 * classifies each result as a *linked* mention (the result URL is on the brand's
 * own domain or already points at it) vs an *unlinked* mention (a third-party page
 * that names the brand but isn't on its domain — a backlink opportunity).
 */
import { z } from 'zod';
import type { McpToolDef } from '@aeo/mcp-core';
import { search, queryIndex } from '@aeo/backlinks';
import { jsonResult, type Json } from '../lib/result.js';
import { hostMatchesDomain } from '../lib/links.js';
import type { ToolDeps } from './deps.js';

const inputSchema = {
  brand: z.string().min(1).describe('Brand or product name to search mentions for.'),
  domain: z
    .string()
    .optional()
    .describe("The brand's own domain (e.g. acme.com) — used to classify linked vs unlinked."),
  limit: z.number().int().min(1).max(50).optional().describe('Max results (default 20).'),
};

type Shape = typeof inputSchema;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

export function findMentionsTool(deps: ToolDeps): McpToolDef<Shape> {
  return {
    name: 'find_mentions',
    title: 'Find brand mentions',
    description:
      'Find linked and unlinked mentions of a brand across the web via DuckDuckGo HTML results. ' +
      'When a domain is supplied, classifies each mention as linked (on the brand domain) or ' +
      'unlinked (a third-party page — a potential backlink opportunity).',
    inputSchema,
    handler: async ({ brand, domain, limit }) => {
      const max = limit ?? deps.maxResults;
      // Quote the brand to bias toward exact-name mentions.
      const { results, warnings } = await search(deps.http, `"${brand}"`, max);

      const linked: Json[] = [];
      const unlinked: Json[] = [];
      const seenUrls = new Set<string>();
      for (const r of results) {
        seenUrls.add(r.url);
        const entry: Json = { title: r.title, url: r.url, snippet: r.snippet };
        if (domain && hostMatchesDomain(hostOf(r.url), domain)) {
          linked.push(entry);
        } else {
          unlinked.push(entry);
        }
      }

      // Supplementary free source: when a domain is known, surface pages
      // CommonCrawl has indexed on that domain as additional *linked* coverage
      // (a corroborating signal the brand owns/controls them). De-duplicated
      // against the DDG results so we never double-count a URL. Degrades to an
      // empty list + warning — never throws.
      const supplementary: Json[] = [];
      if (domain) {
        const cc = await queryIndex(deps.http, domain, {
          index: deps.commonCrawlIndex,
          limit: max,
        });
        for (const w of cc.warnings) warnings.push(`[commoncrawl] ${w}`);
        for (const c of cc.captures) {
          if (seenUrls.has(c.url)) continue;
          if (!hostMatchesDomain(c.host, domain)) continue;
          seenUrls.add(c.url);
          supplementary.push({ url: c.url, host: c.host, source: 'commoncrawl' });
        }
      }

      return jsonResult({
        brand,
        domain: domain ?? null,
        totalResults: results.length,
        // Without a domain every result is reported as an (unclassified) mention.
        linkedMentions: domain ? linked : null,
        unlinkedMentions: unlinked,
        // Extra pages discovered via CommonCrawl (only when a domain is given).
        commonCrawlMentions: domain ? supplementary : null,
        warnings,
      });
    },
  };
}
