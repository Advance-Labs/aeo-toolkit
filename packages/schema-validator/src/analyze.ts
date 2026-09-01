/**
 * Top-level structured-data analysis: load HTML once, run all three extractors, and roll the
 * results up into a `StructuredDataReport` with AEO-relevant presence flags.
 */
import * as cheerio from 'cheerio';
import type { AeoSchemaType, StructuredDataItem, StructuredDataReport } from '@advance-labs/types';
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
 * Every schema.org `@type` reachable inside an item's property bag, at any depth.
 *
 * ADV-173. We used to read ONLY `item.type`, the type an extracted item declares for itself.
 * `extractJsonLd` expands arrays and `@graph` members into items, but it does not descend
 * into property VALUES — so a typed object appearing only as a property was invisible. That
 * is not an edge case: `@graph` plus a nested `author: { "@type": "Person" }` is the pattern
 * Google documents, and on advancelabs.dev it meant a page carrying two `Person` nodes
 * reported `hasPerson: false` and failed a rule for markup it already had correctly.
 *
 * Presence is presence at any depth. A `Person` reached through `author`, `founder`, or
 * `mainEntity` is genuinely on the page, and every consumer of these flags is asking
 * "does this page carry the markup", not "is it a root node". `items` deliberately keeps
 * its top-level-only meaning, because `totalItems` and `invalidCount` are about the
 * documents an author actually published, not the nodes inside them.
 */
function nestedShortTypes(value: unknown): string[] {
  const found: string[] = [];
  const seen = new Set<object>(); // self-referential JSON is invalid, but never trust input

  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const entry of node) walk(entry);
      return;
    }
    if (typeof node !== 'object' || node === null) return;
    if (seen.has(node)) return;
    seen.add(node);

    const record = node as Record<string, unknown>;
    if (record['@type'] !== undefined) found.push(...normalizeTypes(record['@type']));
    for (const child of Object.values(record)) walk(child);
  };

  walk(value);
  return found;
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

    // The item's own type, plus every type nested anywhere in its properties (ADV-173).
    const shortTypes = [...itemShortTypes(item), ...nestedShortTypes(item.properties)];

    for (const shortType of shortTypes) {
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
