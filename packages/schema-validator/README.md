# @advance-labs/schema-validator

Detect and validate **all three** structured-data encodings — JSON-LD, Microdata, and RDFa —
from a raw HTML string, then map every item to its schema.org short type and check the required
properties that matter for answer-engine optimization (AEO). This is a clean-room TypeScript
rebuild of the `structured-data-testing-tool` capability. It is pure and network-free: HTML is
parsed in-process with `cheerio`, so it is fully unit-testable without live HTTP.

## Usage

```ts
import { analyzeStructuredData } from '@advance-labs/schema-validator';

const html = await fetchHtmlSomehow(url); // I/O is the caller's responsibility
const report = analyzeStructuredData(html, url);

console.log(report.aeoTypesPresent); // e.g. ['FAQPage', 'Organization']
console.log(report.invalidCount);    // items missing required properties
for (const item of report.items) {
  if (!item.valid) console.warn(item.type, 'missing', item.missingRequired);
}
```

The low-level extractors operate on a loaded `cheerio` document if you need finer control:

```ts
import * as cheerio from 'cheerio';
import { extractJsonLd, extractMicrodata, extractRdfa, validateItem } from '@advance-labs/schema-validator';

const $ = cheerio.load(html);
const items = [...extractJsonLd($), ...extractMicrodata($), ...extractRdfa($)];
const result = validateItem('FAQPage', { mainEntity: [/* ... */] });
```

## Public API

| Export | Signature | Purpose |
|--------|-----------|---------|
| `analyzeStructuredData` | `(html: string, url: string) => StructuredDataReport` | Run all extractors and roll up a report with AEO presence flags. |
| `extractJsonLd` | `($: CheerioAPI) => StructuredDataItem[]` | JSON-LD from `<script type="application/ld+json">`, flattening `@graph` and arrays. |
| `extractMicrodata` | `($: CheerioAPI) => StructuredDataItem[]` | Microdata via `itemscope` / `itemtype` / `itemprop`, with nested items. |
| `extractRdfa` | `($: CheerioAPI) => StructuredDataItem[]` | RDFa Lite via `vocab` / `typeof` / `property`, with nested resources. |
| `validateItem` | `(type: string, properties: Record<string, unknown>) => ValidationResult` | Check required properties for a (possibly multi-) schema.org type. |
| `toShortType` | `(raw: string) => string` | Collapse any schema.org type reference to its short name. |
| `normalizeTypes` | `(value: unknown) => string[]` | Normalize a `@type` string/array to ordered, de-duplicated short names. |
| `isAeoSchemaType` | `(shortType: string) => shortType is AeoSchemaType` | Narrow to the AEO-relevant schema.org type set. |

All report/item shapes (`StructuredDataReport`, `StructuredDataItem`, `StructuredDataFormat`,
`AeoSchemaType`) are imported from `@advance-labs/types` and never redefined here.

### Validated types

Required-property validation is enforced for the key AEO types: **FAQPage** (`mainEntity` with
`Question` + `acceptedAnswer`), **QAPage**, **HowTo** (`step`), **Article / NewsArticle /
BlogPosting** (`headline`), **Person** (`name`), **Organization** (`name`), **BreadcrumbList**
(`itemListElement`), **Product** (`name`), **Review** (`reviewRating`), and **LocalBusiness**
(`name` + `address`). Unknown types are passed through as `valid: true` (we only assert rules we
have defined).

## Status

**Implemented** — all three extractors, schema.org type normalization, AEO required-property
validation, and the aggregate report are fully implemented with no stubs. No live network or
filesystem I/O: callers supply the HTML.
