/**
 * @aeo/html-parser — pure HTML extraction (no network, no filesystem).
 *
 * `parseHtml(html, url)` returns the full `ParsedHtml` shape. The individual
 * extractor helpers are also exported as string-in convenience functions so a
 * consumer can pull a single signal without loading cheerio themselves.
 */
import * as cheerio from 'cheerio';
import type {
  ContentSignals,
  HeadingNode,
  ImageInfo,
  LinkInfo,
  MetaTags,
  OpenGraph,
  RawStructuredDataBlock,
  TwitterCard,
} from '@aeo/types';

import { computeContentSignals as computeContentSignalsFromDom } from './content.js';
import { extractHeadings as extractHeadingsFromDom } from './headings.js';
import { extractImages as extractImagesFromDom } from './images.js';
import { extractLinks as extractLinksFromDom } from './links.js';
import {
  extractMeta as extractMetaFromDom,
  extractOpenGraph as extractOpenGraphFromDom,
  extractTwitter as extractTwitterFromDom,
} from './meta.js';
import { extractRawStructuredData as extractRawStructuredDataFromDom } from './structured-data.js';

export { parseHtml } from './parse.js';

/** Extract document meta (title/description + lengths, canonical, robots, etc.). */
export function extractMeta(html: string, url: string): MetaTags {
  return extractMetaFromDom(cheerio.load(html), url);
}

/** Extract OpenGraph tags; `complete` requires the og title/description/image/url quartet. */
export function extractOpenGraph(html: string, url: string): OpenGraph {
  return extractOpenGraphFromDom(cheerio.load(html), url);
}

/** Extract Twitter card tags (accepts both `name=` and `property=` forms). */
export function extractTwitter(html: string, url: string): TwitterCard {
  return extractTwitterFromDom(cheerio.load(html), url);
}

/** Extract the heading tree (h1–h6) in document order. */
export function extractHeadings(html: string): HeadingNode[] {
  return extractHeadingsFromDom(cheerio.load(html));
}

/** Extract `<img>` elements with `hasAlt` and resolved `src`. */
export function extractImages(html: string, url: string): ImageInfo[] {
  return extractImagesFromDom(cheerio.load(html), url);
}

/** Extract anchor links, classified internal/external and nofollow. */
export function extractLinks(html: string, url: string): LinkInfo[] {
  return extractLinksFromDom(cheerio.load(html), url);
}

/**
 * Compute content signals from an HTML string. Re-derives headings and raw
 * structured data internally so the helper is fully self-contained.
 */
export function computeContentSignals(html: string): ContentSignals {
  const $ = cheerio.load(html);
  const headings = extractHeadingsFromDom($);
  const structuredData = extractRawStructuredDataFromDom($);
  return computeContentSignalsFromDom($, headings, structuredData);
}

/** Collect raw structured-data blocks (JSON-LD parsed; microdata/RDFa markers). */
export function extractRawStructuredData(html: string): RawStructuredDataBlock[] {
  return extractRawStructuredDataFromDom(cheerio.load(html));
}

// Re-export pure hierarchy/coverage utilities and the question-heading predicate
// for consumers that already hold extracted data (e.g. the scoring engine).
export { isHeadingHierarchyValid } from './headings.js';
export { imageAltCoverage } from './images.js';
export { internalLinkCount, externalLinkCount } from './links.js';
export { isQuestionHeading } from './content.js';
export { jsonLdHasType, collectJsonLdTypes } from './structured-data.js';
