import type { ImageResponse } from 'next/og';
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/lib/og';

export const runtime = 'nodejs';
export const alt = 'AEO Toolkit — LLM & Technical SEO Audit';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image(): ImageResponse {
  return renderOgImage({
    eyebrow: 'Technical SEO + AEO Audit',
    title: 'Crawl, score & fix on a 100-point scale',
    subtitle: 'Free technical + answer-engine audit — no sign-up. Get a prioritized fix list.',
  });
}
