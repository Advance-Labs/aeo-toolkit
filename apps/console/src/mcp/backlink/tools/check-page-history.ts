/**
 * `check_page_history` — Wayback Machine snapshot timeline for a URL.
 *
 * Queries the Internet Archive CDX API and returns first/last seen plus a bounded
 * list of snapshots. Useful for gauging a prospect's authority/longevity and for
 * checking whether a once-placed link still existed at a point in time.
 */
import { z } from 'zod';
import type { McpToolDef } from '@advance-labs/mcp-core';
import { fetchHistory } from '@advance-labs/backlinks';
import { jsonResult, type Json } from '../lib/result.js';
import type { ToolDeps } from '../deps.js';

const inputSchema = {
  url: z.string().url().describe('The URL to look up in the Wayback Machine.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .describe('Max snapshots to return (default 50).'),
};

type Shape = typeof inputSchema;

export function checkPageHistoryTool(deps: ToolDeps): McpToolDef<Shape> {
  return {
    name: 'check_page_history',
    title: 'Check page history',
    description:
      'Return a Wayback Machine timeline for a URL: total snapshots, first/last archived dates, ' +
      'and a bounded list of snapshot records with direct archive links.',
    inputSchema,
    handler: async ({ url, limit }) => {
      const outcome = await fetchHistory(deps.http, url, limit ?? 50);
      return jsonResult({
        url: outcome.url,
        totalSnapshots: outcome.totalSnapshots,
        first: (outcome.first ?? null) as Json,
        last: (outcome.last ?? null) as Json,
        snapshots: outcome.snapshots as unknown as Json[],
        warnings: outcome.warnings,
      });
    },
  };
}
