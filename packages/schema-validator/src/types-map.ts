/**
 * schema.org @type normalization helpers.
 *
 * schema.org types arrive in many shapes: a bare short name ("FAQPage"), a full URL
 * ("https://schema.org/FAQPage"), an `http://` variant, a trailing slash, or an array of
 * types. We collapse all of these into the short PascalCase name so downstream validation
 * and AEO detection only ever deal with one canonical form.
 */
import type { AeoSchemaType } from '@advance-labs/types';

/** The closed set of AEO-relevant schema.org types, mirrored from `@advance-labs/types`. */
const AEO_SCHEMA_TYPES = [
  'FAQPage',
  'QAPage',
  'HowTo',
  'Article',
  'NewsArticle',
  'BlogPosting',
  'Person',
  'Organization',
  'BreadcrumbList',
  'Product',
  'Review',
  'AggregateRating',
  'LocalBusiness',
  'WebSite',
  'WebPage',
  'Speakable',
  'VideoObject',
  'Recipe',
  'Event',
] as const satisfies readonly AeoSchemaType[];

const AEO_SCHEMA_TYPE_SET: ReadonlySet<string> = new Set<string>(AEO_SCHEMA_TYPES);

/**
 * Reduce any schema.org type reference to its short name.
 *
 * Handles `https://schema.org/FAQPage`, `http://schema.org/FAQPage`, `schema:FAQPage`,
 * a trailing `/`, surrounding whitespace, and a bare `FAQPage`. Returns the input trimmed
 * when no known prefix matches (so custom/unknown types survive untouched).
 */
export function toShortType(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return trimmed;

  // Strip a trailing slash, then take the final path/segment after the last separator.
  const noTrailingSlash = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;

  // CURIE form like "schema:FAQPage" or vocab-prefixed "foaf:Person".
  const colonIdx = noTrailingSlash.lastIndexOf(':');
  const slashIdx = noTrailingSlash.lastIndexOf('/');
  const hashIdx = noTrailingSlash.lastIndexOf('#');

  const cut = Math.max(colonIdx, slashIdx, hashIdx);
  const segment = cut >= 0 ? noTrailingSlash.slice(cut + 1) : noTrailingSlash;
  return segment.trim();
}

/**
 * Normalize a `@type` value (string, array, or unknown) to an ordered, de-duplicated list of
 * short type names. An item may legitimately declare multiple types
 * (e.g. `["Product", "LocalBusiness"]`).
 */
export function normalizeTypes(value: unknown): string[] {
  const out: string[] = [];
  const push = (v: unknown): void => {
    if (typeof v !== 'string') return;
    const short = toShortType(v);
    if (short.length > 0 && !out.includes(short)) out.push(short);
  };

  if (Array.isArray(value)) {
    for (const entry of value) push(entry);
  } else {
    push(value);
  }
  return out;
}

/** Type guard: is this short type one of the AEO-relevant schema.org types? */
export function isAeoSchemaType(shortType: string): shortType is AeoSchemaType {
  return AEO_SCHEMA_TYPE_SET.has(shortType);
}
