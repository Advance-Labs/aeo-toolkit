import type { ImageResponse } from 'next/og';
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/lib/og';

export const runtime = 'nodejs';
export const alt = 'About Advance Labs — the studio behind AEO Toolkit';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image(): ImageResponse {
  return renderOgImage({
    eyebrow: 'About',
    title: 'The studio behind AEO Toolkit',
    subtitle: 'Advance Labs — a Canadian software studio building open tools for AI search.',
  });
}
