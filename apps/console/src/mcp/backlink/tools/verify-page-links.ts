/**
 * `verify_page_links` — confirm a page links to a target domain.
 *
 * Fetches the page via the injected HTTP client (redirect-aware) and runs the pure
 * `verifyLinks` parser over its HTML, reporting every matching anchor with its
 * rel attributes (nofollow / sponsored / ugc) so you can confirm a placed link is
 * live and whether it passes SEO equity.
 */
import { z } from 'zod';
import type { McpToolDef } from '@aeo/mcp-core';
import { jsonResult, type Json } from '../lib/result.js';
import { verifyLinks } from '../lib/links.js';
import type { ToolDeps } from '../deps.js';

const inputSchema = {
  url: z.string().url().describe('The page URL to inspect.'),
  targetDomain: z
    .string()
    .min(1)
    .describe('The domain the link should point to (e.g. yoursite.com).'),
};

type Shape = typeof inputSchema;

export function verifyPageLinksTool(deps: ToolDeps): McpToolDef<Shape> {
  return {
    name: 'verify_page_links',
    title: 'Verify page links',
    description:
      'Fetch a page and confirm whether it contains a link to the target domain, reporting anchor ' +
      'text and rel attributes (nofollow/sponsored/ugc) and whether the link is dofollow.',
    inputSchema,
    handler: async ({ url, targetDomain }) => {
      const page = await deps.http.getResource(url);
      const warnings: string[] = [];

      if (!page.ok || page.body === undefined || page.body === '') {
        const reason = page.error ?? `status ${page.status}`;
        warnings.push(`Could not fetch page (${reason}).`);
        return jsonResult({
          url,
          finalUrl: page.finalUrl,
          status: page.status,
          targetDomain,
          linkFound: false,
          dofollowFound: false,
          matches: [],
          totalLinksOnPage: 0,
          warnings,
        });
      }

      const outcome = verifyLinks(page.body, page.finalUrl, targetDomain);

      return jsonResult({
        url,
        finalUrl: page.finalUrl,
        status: page.status,
        targetDomain: outcome.targetDomain,
        linkFound: outcome.linkFound,
        dofollowFound: outcome.dofollowFound,
        totalLinksOnPage: outcome.totalLinksOnPage,
        matches: outcome.matches as unknown as Json[],
        warnings,
      });
    },
  };
}
