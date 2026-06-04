import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

/**
 * The answer-engine crawlers we explicitly welcome. Many sites accidentally block these (our auditor
 * scores it as a penalty) — the toolkit dogfoods the opposite: allow every AI bot, link the sitemap.
 */
const AI_BOTS: readonly string[] = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'anthropic-ai',
  'PerplexityBot',
  'Google-Extended',
];

export default function robots(): MetadataRoute.Robots {
  const base = SITE_URL.replace(/\/$/, '');
  return {
    rules: [
      // Default: open to all classic search crawlers; keep auth + API plumbing out of the index.
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/.well-known/'],
      },
      // Explicitly welcome each answer-engine crawler across all content. Named user-agent groups do
      // NOT inherit the `*` group's rules, so we repeat the API/plumbing disallow here — otherwise AI
      // bots would crawl the POST-only MCP/tool endpoints under /api/ and dead-end on 404/405s.
      ...AI_BOTS.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: ['/api/', '/.well-known/'],
      })),
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
