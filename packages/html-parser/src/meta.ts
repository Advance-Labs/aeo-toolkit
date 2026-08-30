/** Meta-tag, canonical, and document-level attribute extraction. */
import type { CheerioAPI } from 'cheerio';
import type { MetaTags, OpenGraph, TwitterCard } from '@advance-labs/types';

import { resolveUrl } from './url-utils.js';

/** Normalize attribute text: trim and collapse internal whitespace runs. */
function clean(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Read the content of the first `<meta name="...">` (case-insensitive) match.
 * Selectors in cheerio are case-sensitive for attribute *values*, so we scan.
 */
function metaByName($: CheerioAPI, name: string): string | undefined {
  const lower = name.toLowerCase();
  let found: string | undefined;
  $('meta[name]').each((_, el) => {
    if (found !== undefined) return;
    const attr = $(el).attr('name');
    if (attr !== undefined && attr.toLowerCase() === lower) {
      found = clean($(el).attr('content'));
    }
  });
  return found;
}

/** Read the content of the first `<meta property="...">` match (for OG). */
function metaByProperty($: CheerioAPI, property: string): string | undefined {
  const lower = property.toLowerCase();
  let found: string | undefined;
  $('meta[property]').each((_, el) => {
    if (found !== undefined) return;
    const attr = $(el).attr('property');
    if (attr !== undefined && attr.toLowerCase() === lower) {
      found = clean($(el).attr('content'));
    }
  });
  return found;
}

/**
 * Twitter card tags appear in the wild as either `name="twitter:*"` (the spec)
 * or `property="twitter:*"`. Check both.
 */
function twitterTag($: CheerioAPI, key: string): string | undefined {
  return metaByName($, key) ?? metaByProperty($, key);
}

/**
 * Extract document meta: title, description, canonical, robots, viewport,
 * charset, lang, theme-color — plus title/description character lengths.
 */
export function extractMeta($: CheerioAPI, pageUrl: string): MetaTags {
  const title = clean($('head > title').first().text());
  const description = metaByName($, 'description');

  const canonicalHref = clean($('link[rel="canonical"]').first().attr('href'));
  const canonical = canonicalHref !== undefined ? resolveUrl(canonicalHref, pageUrl) : undefined;

  // charset can be `<meta charset>` or the legacy `http-equiv` form.
  let charset = clean($('meta[charset]').first().attr('charset'));
  if (charset === undefined) {
    const httpEquiv = metaByHttpEquiv($, 'content-type');
    if (httpEquiv !== undefined) {
      const match = /charset=([^;\s]+)/i.exec(httpEquiv);
      charset = match?.[1];
    }
  }

  const lang = clean($('html').first().attr('lang'));

  return {
    title,
    titleLength: title?.length ?? 0,
    description,
    descriptionLength: description?.length ?? 0,
    canonical,
    robots: metaByName($, 'robots'),
    viewport: metaByName($, 'viewport'),
    charset,
    lang,
    themeColor: metaByName($, 'theme-color'),
  };
}

/** Read a `<meta http-equiv="...">` content value (case-insensitive name). */
function metaByHttpEquiv($: CheerioAPI, equiv: string): string | undefined {
  const lower = equiv.toLowerCase();
  let found: string | undefined;
  $('meta[http-equiv]').each((_, el) => {
    if (found !== undefined) return;
    const attr = $(el).attr('http-equiv');
    if (attr !== undefined && attr.toLowerCase() === lower) {
      found = clean($(el).attr('content'));
    }
  });
  return found;
}

/**
 * Extract OpenGraph tags. `complete` is true only when the core quartet
 * (og:title, og:description, og:image, og:url) is all present.
 */
export function extractOpenGraph($: CheerioAPI, pageUrl: string): OpenGraph {
  const title = metaByProperty($, 'og:title');
  const description = metaByProperty($, 'og:description');
  const imageRaw = metaByProperty($, 'og:image');
  const urlRaw = metaByProperty($, 'og:url');

  const image = imageRaw !== undefined ? resolveUrl(imageRaw, pageUrl) : undefined;
  const url = urlRaw !== undefined ? resolveUrl(urlRaw, pageUrl) : undefined;

  const complete =
    title !== undefined && description !== undefined && image !== undefined && url !== undefined;

  return {
    title,
    description,
    type: metaByProperty($, 'og:type'),
    url,
    image,
    siteName: metaByProperty($, 'og:site_name'),
    complete,
  };
}

/** Extract Twitter card tags (accepting both `name=` and `property=` forms). */
export function extractTwitter($: CheerioAPI, pageUrl: string): TwitterCard {
  const imageRaw = twitterTag($, 'twitter:image');
  return {
    card: twitterTag($, 'twitter:card'),
    title: twitterTag($, 'twitter:title'),
    description: twitterTag($, 'twitter:description'),
    image: imageRaw !== undefined ? resolveUrl(imageRaw, pageUrl) : undefined,
    site: twitterTag($, 'twitter:site'),
  };
}
