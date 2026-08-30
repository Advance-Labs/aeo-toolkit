/** Image extraction with alt-text coverage. */
import type { CheerioAPI } from 'cheerio';
import type { ImageInfo } from '@advance-labs/types';

import { resolveUrl } from './url-utils.js';

/** Parse a numeric HTML dimension attribute (`width`/`height`); ignore non-numeric. */
function dimension(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Extract `<img>` elements with resolved `src`, alt text, and alt presence.
 * Images without a `src` (or with an empty one) are dropped — there is nothing
 * to score. A present-but-empty `alt=""` counts as *not* having descriptive alt.
 */
export function extractImages($: CheerioAPI, pageUrl: string): ImageInfo[] {
  const images: ImageInfo[] = [];
  $('img').each((_, el) => {
    const $el = $(el);
    const rawSrc = $el.attr('src')?.trim();
    if (rawSrc === undefined || rawSrc.length === 0) return;

    const altRaw = $el.attr('alt');
    const alt = altRaw?.trim();
    const hasAlt = alt !== undefined && alt.length > 0;

    images.push({
      src: resolveUrl(rawSrc, pageUrl),
      alt: altRaw,
      hasAlt,
      width: dimension($el.attr('width')),
      height: dimension($el.attr('height')),
    });
  });
  return images;
}

/** Fraction of images with non-empty alt text, 0..1. Empty set → 1 (vacuously). */
export function imageAltCoverage(images: ImageInfo[]): number {
  if (images.length === 0) return 1;
  const withAlt = images.filter((img) => img.hasAlt).length;
  return withAlt / images.length;
}
