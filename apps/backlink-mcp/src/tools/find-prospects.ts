/**
 * `find_prospects` — surface guest-post and resource-page link opportunities.
 *
 * Runs a small fan-out of intent queries (the classic link-building footprints:
 * "write for us", "resource page", "submit a guest post", etc.) for the topic and
 * merges + de-duplicates the results, tagging each with the angle that found it.
 */
import { z } from 'zod';
import type { McpToolDef } from '@aeo/mcp-core';
import { jsonResult, type Json } from '../lib/result.js';
import { search } from '../lib/duckduckgo.js';
import type { ToolDeps } from './deps.js';

const inputSchema = {
  topic: z.string().min(1).describe('Niche or topic to find link-building prospects for.'),
  limitPerAngle: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .describe('Max results per outreach angle (default 8).'),
};

type Shape = typeof inputSchema;

interface Angle {
  label: 'guest-post' | 'resource-page' | 'write-for-us' | 'roundup';
  query: (topic: string) => string;
}

const ANGLES: Angle[] = [
  { label: 'write-for-us', query: (t) => `${t} "write for us"` },
  { label: 'guest-post', query: (t) => `${t} "submit a guest post"` },
  { label: 'resource-page', query: (t) => `${t} intitle:resources` },
  { label: 'roundup', query: (t) => `${t} "best" intitle:roundup` },
];

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function findProspectsTool(deps: ToolDeps): McpToolDef<Shape> {
  return {
    name: 'find_prospects',
    title: 'Find link prospects',
    description:
      'Find guest-post, resource-page, and roundup link-building prospects for a topic by running ' +
      'classic outreach footprints through DuckDuckGo and merging the results by host.',
    inputSchema,
    handler: async ({ topic, limitPerAngle }) => {
      const perAngle = limitPerAngle ?? Math.min(deps.maxResults, 8);
      const warnings: string[] = [];
      const byHost = new Map<string, { title: string; url: string; angles: Set<string> }>();

      for (const angle of ANGLES) {
        const outcome = await search(deps.http, angle.query(topic), perAngle);
        for (const w of outcome.warnings) warnings.push(`[${angle.label}] ${w}`);
        for (const r of outcome.results) {
          const host = hostOf(r.url);
          if (host === '') continue;
          const existing = byHost.get(host);
          if (existing) {
            existing.angles.add(angle.label);
          } else {
            byHost.set(host, { title: r.title, url: r.url, angles: new Set([angle.label]) });
          }
        }
      }

      const prospects: Json[] = [...byHost.entries()].map(([host, p]) => ({
        host,
        title: p.title,
        url: p.url,
        angles: [...p.angles],
      }));

      return jsonResult({
        topic,
        totalProspects: prospects.length,
        prospects,
        warnings,
      });
    },
  };
}
