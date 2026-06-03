/**
 * Top-level structured-data analysis: load HTML once, run all three extractors, and roll the
 * results up into a `StructuredDataReport` with AEO-relevant presence flags.
 */
import * as cheerio from 'cheerio';
import type { AeoSchemaType, StructuredDataItem, StructuredDataReport } from '@aeo/types';
import { extractJsonLd } from './json-ld.js';
import { extractMicrodata } from './microdata.js';
import { extractRdfa } from './rdfa.js';
import { isAeoSchemaType, normalizeTypes } from './types-map.js';

const ARTICLE_TYPES: ReadonlySet<string> = new Set(['Article', 'NewsArticle', 'BlogPosting']);
const FAQ_QA_TYPES: ReadonlySet<string> = new Set(['FAQPage', 'QAPage']);

/** All short types an item declares (its `type` field may join several with commas). */
function itemShortTypes(item: StructuredDataItem): string[] {
  return normalizeTypes(item.type.split(',').filter(Boolean));
}

/**
 * Analyze every structured-data encoding in a raw HTML document.
 *
 * Pure and network-free: HTML is parsed in-process with cheerio. The `url` is carried into
 * the result for callers that aggregate reports across pages — it is not fetched.
 *
 * @param html Raw HTML source of the page.
 * @param url The page URL (recorded, never fetched).
 */
export function analyzeStructuredData(html: string, url: string): StructuredDataReport {
  // `url` is part of the public contract (per-page provenance) even though analysis is offline.
  void url;

  const $ = cheerio.load(html);

  const items: StructuredDataItem[] = [
    ...extractJsonLd($),
    ...extractMicrodata($),
    ...extractRdfa($),
  ];

  const typesPresentSet = new Set<string>();
  const aeoTypesSet = new Set<AeoSchemaType>();
  let hasOrganization = false;
  let hasPerson = false;
  let hasArticle = false;
  let hasBreadcrumb = false;
  let hasFaqOrQa = false;
  let invalidCount = 0;

  for (const item of items) {
    if (!item.valid) invalidCount += 1;

    for (const shortType of itemShortTypes(item)) {
      if (shortType.length === 0) continue;
      typesPresentSet.add(shortType);
      if (isAeoSchemaType(shortType)) aeoTypesSet.add(shortType);

      if (shortType === 'Organization') hasOrganization = true;
      if (shortType === 'LocalBusiness') hasOrganization = true; // LocalBusiness ⊂ Organization
      if (shortType === 'Person') hasPerson = true;
      if (ARTICLE_TYPES.has(shortType)) hasArticle = true;
      if (shortType === 'BreadcrumbList') hasBreadcrumb = true;
      if (FAQ_QA_TYPES.has(shortType)) hasFaqOrQa = true;
    }
  }

  return {
    items,
    typesPresent: [...typesPresentSet],
    aeoTypesPresent: [...aeoTypesSet],
    hasOrganization,
    hasPerson,
    hasArticle,
    hasBreadcrumb,
    hasFaqOrQa,
    totalItems: items.length,
    invalidCount,
  };
}
