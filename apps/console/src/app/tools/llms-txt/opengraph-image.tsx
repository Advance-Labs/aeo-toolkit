import type { ImageResponse } from 'next/og';
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/lib/og';

export const runtime = 'nodejs';
export const alt = 'AEO Toolkit — llms.txt Generator';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image(): ImageResponse {
  return renderOgImage({
    eyebrow: 'llms.txt Generator',
    title: 'Build an AI crawl map for ChatGPT & Claude',
    subtitle: 'Generate a ready-to-ship llms.txt so answer engines cite the right pages.',
  });
}
