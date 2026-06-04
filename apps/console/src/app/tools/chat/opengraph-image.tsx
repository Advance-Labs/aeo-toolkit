import type { ImageResponse } from 'next/og';
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/lib/og';

export const runtime = 'nodejs';
export const alt = 'AEO Toolkit — GA4 + Search Console Chat';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image(): ImageResponse {
  return renderOgImage({
    eyebrow: 'GA4 + Search Console Chat',
    title: 'Ask your SEO data in plain English',
    subtitle: 'Bring your own key. Read-only access to GA4 + GSC. Nothing stored.',
  });
}
