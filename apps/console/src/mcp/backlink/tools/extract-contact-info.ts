/**
 * `extract_contact_info` — emails + social handles from a page.
 *
 * Fetches the page via the injected HTTP client and runs the pure `extractContacts`
 * parser over its HTML. Useful for turning a prospect URL into an actual outreach
 * target.
 */
import { z } from 'zod';
import type { McpToolDef } from '@advance-labs/mcp-core';
import { extractContacts } from '@advance-labs/backlinks';
import { jsonResult, type Json } from '../lib/result.js';
import type { ToolDeps } from '../deps.js';

const inputSchema = {
  url: z.string().url().describe('The page URL to extract contact info from.'),
};

type Shape = typeof inputSchema;

export function extractContactInfoTool(deps: ToolDeps): McpToolDef<Shape> {
  return {
    name: 'extract_contact_info',
    title: 'Extract contact info',
    description:
      'Fetch a page and extract contact emails (including de-obfuscated and mailto links) and ' +
      'social media handles (Twitter/X, LinkedIn, Facebook, Instagram, GitHub, YouTube).',
    inputSchema,
    handler: async ({ url }) => {
      const page = await deps.http.getResource(url);
      const warnings: string[] = [];

      if (!page.ok || page.body === undefined || page.body === '') {
        const reason = page.error ?? `status ${page.status}`;
        warnings.push(`Could not fetch page (${reason}).`);
        return jsonResult({
          url,
          finalUrl: page.finalUrl,
          status: page.status,
          emails: [],
          socials: [],
          warnings,
        });
      }

      const contacts = extractContacts(page.body, page.finalUrl);
      if (contacts.emails.length === 0 && contacts.socials.length === 0) {
        warnings.push('No emails or social handles found on the page.');
      }

      return jsonResult({
        url,
        finalUrl: page.finalUrl,
        status: page.status,
        emails: contacts.emails as unknown as Json[],
        socials: contacts.socials as unknown as Json[],
        warnings,
      });
    },
  };
}
