/**
 * `find_competitor_link_sources` — pages that link to a competitor.
 *
 * There is no free, complete backlink index, so we approximate with two free
 * signals: a `link:`/mention search for the competitor's domain on DuckDuckGo, and
 * the competitor's own brand-name mentions. Results are de-duplicated by host and
 * the competitor's own domain is excluded (you want third-party linkers).
 */
import { z } from 'zod';
import type { McpToolDef } from '@aeo/mcp-core';
import { search, queryIndex } from '@aeo/backlinks';
import { jsonResult, type Json } from '../lib/result.js';
import { normalizeDomain, hostMatchesDomain } from '../lib/links.js';
import type { ToolDeps } from './deps.js';

const inputSchema = {
  competitorUrl: z
    .string()
    .min(1)
    .describe("Competitor's URL or domain (e.g. https://competitor.com or competitor.com)."),
  limit: z.number().int().min(1).max(40).optional().describe('Max sources (default 20).'),
};

type Shape = typeof inputSchema;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Derive a plausible brand token from a domain (the SLD), for mention search. */
function brandFromDomain(domain: string): string {
  const parts = domain.split('.');
  return parts.length >= 2 ? (parts[parts.length - 2] ?? domain) : domain;
}

export function findCompetitorLinkSourcesTool(deps: ToolDeps): McpToolDef<Shape> {
  return {
    name: 'find_competitor_link_sources',
    title: 'Find competitor link sources',
    description:
      'Approximate the pages linking to a competitor using free DuckDuckGo signals (domain mentions ' +
      "and brand mentions). De-duplicates by host and excludes the competitor's own domain. Not a " +
      'complete backlink index — a free, directional starting point for prospecting.',
    inputSchema,
    handler: async ({ competitorUrl, limit }) => {
      const domain = normalizeDomain(competitorUrl);
      const max = limit ?? deps.maxResults;
      if (domain === '') {
        return jsonResult({
          competitorDomain: null,
          totalSources: 0,
          sources: [],
          warnings: ['Could not derive a domain from the input.'],
        });
      }

      const brand = brandFromDomain(domain);
      const queries = [`"${domain}" -site:${domain}`, `"${brand}" -site:${domain}`];
      const warnings: string[] = [];
      const byHost = new Map<string, { title: string; url: string; via: Set<string> }>();

      for (const q of queries) {
        const outcome = await search(deps.http, q, max);
        for (const w of outcome.warnings) warnings.push(`[${q}] ${w}`);
        for (const r of outcome.results) {
          const host = hostOf(r.url);
          if (host === '' || hostMatchesDomain(host, domain)) continue;
          const existing = byHost.get(host);
          if (existing) {
            existing.via.add(q);
          } else {
            byHost.set(host, { title: r.title, url: r.url, via: new Set([q]) });
          }
        }
      }

      const sources: Json[] = [...byHost.entries()]
        .slice(0, max)
        .map(([host, s]) => ({ host, title: s.title, url: s.url, foundVia: [...s.via] }));

      // Supplementary free source: CommonCrawl's index of the competitor's own
      // pages. These are not third-party linkers (so they stay *out* of
      // `sources`), but they are a high-signal list of the competitor's
      // link-attracting URLs — the pages worth replicating/out-creating when
      // prospecting. The wildcard query is path-scoped to the competitor domain,
      // so every capture is on that domain by construction. Degrades gracefully.
      const cc = await queryIndex(deps.http, domain, {
        index: deps.commonCrawlIndex,
        limit: max,
      });
      for (const w of cc.warnings) warnings.push(`[commoncrawl] ${w}`);
      const seenCcUrls = new Set<string>();
      const commonCrawlPages: Json[] = [];
      for (const c of cc.captures) {
        if (seenCcUrls.has(c.url)) continue;
        seenCcUrls.add(c.url);
        commonCrawlPages.push({ url: c.url, host: c.host, source: 'commoncrawl' });
        if (commonCrawlPages.length >= max) break;
      }

      return jsonResult({
        competitorDomain: domain,
        totalSources: sources.length,
        sources,
        commonCrawlPages,
        warnings,
      });
    },
  };
}
