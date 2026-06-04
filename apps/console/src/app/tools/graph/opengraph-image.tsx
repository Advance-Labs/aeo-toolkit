import type { ImageResponse } from 'next/og';
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/lib/og';

export const runtime = 'nodejs';
export const alt = 'AEO Toolkit — Backlink Graph';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image(): ImageResponse {
  return renderOgImage({
    eyebrow: 'Backlink Graph',
    title: 'Visualize your backlink universe in 3D',
    subtitle: 'Map referring domains and brand mentions in an interactive graph.',
  });
}
