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
 * Images without a `src` (or with an empty one) are dropped — there is nothing to score.
 *
 * Three states, not two (ADV-174): a non-empty `alt` is described (`hasAlt`), an `alt=""` is
 * explicitly decorative (`isDecorative`), and a missing `alt` attribute is neither — an
 * omission. Collapsing the first two categories is what made `imageAltCoverage` report 58%
 * for a page that was 100% correct.
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
    // Attribute PRESENT but empty => the author declared it decorative.
    const isDecorative = altRaw !== undefined && !hasAlt;

    images.push({
      src: resolveUrl(rawSrc, pageUrl),
      alt: altRaw,
      hasAlt,
      isDecorative,
      width: dimension($el.attr('width')),
      height: dimension($el.attr('height')),
    });
  });
  return images;
}

/**
 * Fraction of images NEEDING alt text that have it, 0..1. Empty set → 1 (vacuously).
 *
 * Images the author marked decorative (`alt=""`) are excluded from BOTH sides of the ratio
 * (ADV-174): they neither need describing nor count against the page. A page of correctly
 * marked decorative icons therefore scores 1, not 0 — the previous behaviour failed
 * advancelabs.dev at 58% when every one of its 19 images was marked correctly.
 */
export function imageAltCoverage(images: ImageInfo[]): number {
  const scorable = images.filter((img) => !img.isDecorative);
  if (scorable.length === 0) return 1;
  const withAlt = scorable.filter((img) => img.hasAlt).length;
  return withAlt / scorable.length;
}
