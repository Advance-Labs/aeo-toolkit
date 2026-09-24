import type { ImageResponse } from 'next/og';
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/lib/og';

export const runtime = 'nodejs';
export const alt = 'AEO Toolkit — Website Authority Checker';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image(): ImageResponse {
  return renderOgImage({
    eyebrow: 'Website Authority Checker',
    title: 'Domain authority from a public link graph',
    subtitle: 'Open PageRank 0–10 over Common Crawl. Not DA, not DR, and it says so.',
  });
}
