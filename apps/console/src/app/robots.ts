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
      // Explicitly allow each answer-engine crawler full access.
      ...AI_BOTS.map((userAgent) => ({ userAgent, allow: '/' })),
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
