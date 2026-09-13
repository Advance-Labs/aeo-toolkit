import type { ImageResponse } from 'next/og';
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/lib/og';
import { SITE_TAGLINE } from '@/lib/seo';

export const runtime = 'nodejs';
export const alt = 'AEO Toolkit — Rank in ChatGPT, Claude, Perplexity & AI Overviews';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** Root share card: same renderer as every tool route so the brand stays in one place. */
export default function Image(): ImageResponse {
  return renderOgImage({
    eyebrow: 'Free · open source',
    title: SITE_TAGLINE,
    subtitle: 'Free, open-source audits, E-E-A-T scoring, llms.txt, and AI-visibility tools — one console.',
  });
}
