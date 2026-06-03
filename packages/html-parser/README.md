# @aeo/html-parser

Pure, synchronous HTML extraction for the AEO Toolkit. Given an HTML string and the
URL it came from, it produces the shared `ParsedHtml` shape: document meta, OpenGraph
and Twitter cards, the heading tree, images with alt coverage, internal/external links,
content-quality signals (word count, FAQ/HowTo, question headings, structure counts),
and raw structured-data blocks. **No network and no filesystem access** — fetching is
the job of `@aeo/crawler`, and full schema.org validation is the job of
`@aeo/schema-validator`; this package only collects the raw blocks they need.

## Usage

```ts
import { parseHtml } from '@aeo/html-parser';

const parsed = parseHtml(htmlString, 'https://example.com/page');

console.log(parsed.meta.title, parsed.meta.titleLength);
console.log(parsed.openGraph.complete);
console.log(parsed.imageAltCoverage); // 0..1
console.log(parsed.content.hasFaq, parsed.content.questionHeadingCount);
console.log(parsed.rawStructuredData); // [{ format: 'json-ld', data: {...} }, ...]
```

Each extractor is also exported standalone (accepting an HTML string), so a consumer
can pull a single signal without parsing the whole document:

```ts
import { extractMeta, extractHeadings } from '@aeo/html-parser';

const meta = extractMeta(htmlString, url);
const headings = extractHeadings(htmlString);
```

## Public API

| Export | Signature | Purpose |
| --- | --- | --- |
| `parseHtml` | `(html: string, url: string) => ParsedHtml` | Full extraction into the shared shape. |
| `extractMeta` | `(html: string, url: string) => MetaTags` | Title/description (+lengths), canonical, robots, viewport, charset, lang, theme-color. |
| `extractOpenGraph` | `(html: string, url: string) => OpenGraph` | OG tags; `complete` requires the og title/description/image/url quartet. |
| `extractTwitter` | `(html: string, url: string) => TwitterCard` | Twitter card tags (accepts `name=` and `property=`). |
| `extractHeadings` | `(html: string) => HeadingNode[]` | Heading tree h1–h6 in document order. |
| `extractImages` | `(html: string, url: string) => ImageInfo[]` | `<img>` with resolved `src`, `hasAlt`, dimensions. |
| `extractLinks` | `(html: string, url: string) => LinkInfo[]` | Anchors classified internal/external + nofollow. |
| `computeContentSignals` | `(html: string) => ContentSignals` | Word count, FAQ/HowTo, question headings, paragraph/list/table counts. |
| `extractRawStructuredData` | `(html: string) => RawStructuredDataBlock[]` | JSON-LD parsed; microdata/RDFa presence markers. |
| `isHeadingHierarchyValid` | `(headings: HeadingNode[]) => boolean` | True when headings never skip a level downward. |
| `imageAltCoverage` | `(images: ImageInfo[]) => number` | Fraction of images with alt text, 0..1. |
| `internalLinkCount` / `externalLinkCount` | `(links: LinkInfo[]) => number` | Link counts by classification. |
| `isQuestionHeading` | `(text: string) => boolean` | Whether a heading reads as a question. |
| `jsonLdHasType` / `collectJsonLdTypes` | see source | JSON-LD `@type` inspection helpers. |

All shapes are imported from `@aeo/types`; this package never redefines them.

## Notes

- `hasFaq` is set when an FAQ-flavored heading is present **or** an FAQPage/QAPage
  JSON-LD block exists. `hasHowTo` likewise combines headings and HowTo JSON-LD.
- An empty `alt=""` counts as **not** having descriptive alt text.
- Relative URLs in `canonical`, `og:image`, `twitter:image`, `<img src>`, and `<a href>`
  are resolved against the supplied page URL. Fragment-only (`#...`) anchors are skipped.
- Malformed JSON-LD is silently skipped (it surfaces as a validation finding downstream,
  not a parser crash).

## Status

**Implemented.** All extractors are real (cheerio-backed) with no network/filesystem
dependency and no stubs. Unit-tested with rich-page and sparse-page fixtures.
