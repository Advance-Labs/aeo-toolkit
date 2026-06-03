/**
 * Raw structured-data extraction.
 *
 * This package only *collects* blocks; full schema.org validation is the job of
 * `@aeo/schema-validator`. We:
 *   - parse every `<script type="application/ld+json">` as JSON (skip on error),
 *   - emit a lightweight marker for microdata (`itemscope` present),
 *   - emit a lightweight marker for RDFa (`typeof`/`vocab` present).
 */
import type { CheerioAPI } from 'cheerio';
import type { RawStructuredDataBlock } from '@aeo/types';

/** Recursively collect every `@type` value found in a parsed JSON-LD value. */
export function collectJsonLdTypes(value: unknown, acc: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectJsonLdTypes(item, acc);
    return acc;
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const typeValue = record['@type'];
    if (typeof typeValue === 'string') {
      acc.add(typeValue);
    } else if (Array.isArray(typeValue)) {
      for (const t of typeValue) if (typeof t === 'string') acc.add(t);
    }
    for (const key of Object.keys(record)) {
      collectJsonLdTypes(record[key], acc);
    }
  }
  return acc;
}

/**
 * Extract raw structured-data blocks.
 *
 * JSON-LD blocks that fail to parse are silently skipped (malformed schema is a
 * validation finding, not a parser crash). Microdata/RDFa presence yields a
 * single marker block each, with the parsed item tree left to the validator.
 */
export function extractRawStructuredData($: CheerioAPI): RawStructuredDataBlock[] {
  const blocks: RawStructuredDataBlock[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (raw.trim().length === 0) return;
    try {
      const data: unknown = JSON.parse(raw);
      blocks.push({ format: 'json-ld', data });
    } catch {
      // Skip unparseable JSON-LD — the validator reports malformed schema.
    }
  });

  // Microdata marker: any element opening an item scope.
  if ($('[itemscope]').length > 0) {
    blocks.push({ format: 'microdata', data: { present: true } });
  }

  // RDFa marker: `typeof` or `vocab` attributes signal RDFa usage.
  if ($('[typeof]').length > 0 || $('[vocab]').length > 0) {
    blocks.push({ format: 'rdfa', data: { present: true } });
  }

  return blocks;
}

/** True when any JSON-LD block declares an FAQPage `@type` (anywhere in the tree). */
export function jsonLdHasType(blocks: RawStructuredDataBlock[], typeName: string): boolean {
  const target = typeName.toLowerCase();
  for (const block of blocks) {
    if (block.format !== 'json-ld') continue;
    for (const t of collectJsonLdTypes(block.data)) {
      if (t.toLowerCase() === target) return true;
    }
  }
  return false;
}
