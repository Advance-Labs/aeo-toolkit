/** Top-level HTML parse: orchestrates every extractor into a `ParsedHtml`. */
import * as cheerio from 'cheerio';
import type { ParsedHtml } from '@advance-labs/types';

import { computeContentSignals } from './content.js';
import { extractHeadings, isHeadingHierarchyValid } from './headings.js';
import { extractImages, imageAltCoverage } from './images.js';
import { extractHreflangs, extractLinks, externalLinkCount, internalLinkCount } from './links.js';
import { extractMeta, extractOpenGraph, extractTwitter } from './meta.js';
import { extractRawStructuredData } from './structured-data.js';

/**
 * Parse an HTML string into the shared `ParsedHtml` shape. Pure and
 * synchronous — no network or filesystem access. `url` is used to resolve
 * relative URLs and classify links as internal vs external.
 */
export function parseHtml(html: string, url: string): ParsedHtml {
  const $ = cheerio.load(html);

  const meta = extractMeta($, url);
  const openGraph = extractOpenGraph($, url);
  const twitter = extractTwitter($, url);

  const headings = extractHeadings($);
  const images = extractImages($, url);
  const links = extractLinks($, url);
  const rawStructuredData = extractRawStructuredData($);
  const content = computeContentSignals($, headings, rawStructuredData);

  return {
    url,
    meta,
    openGraph,
    twitter,
    headings,
    headingHierarchyValid: isHeadingHierarchyValid(headings),
    images,
    imageAltCoverage: imageAltCoverage(images),
    links,
    internalLinkCount: internalLinkCount(links),
    externalLinkCount: externalLinkCount(links),
    hreflangs: extractHreflangs($, url),
    content,
    rawStructuredData,
  };
}
