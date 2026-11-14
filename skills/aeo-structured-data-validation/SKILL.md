---
name: aeo-structured-data-validation
description: Check that a site's structured data (JSON-LD, Microdata, RDFa) is present, parses, and is valid, and fix the usual breakage: invalid JSON, missing required properties, duplicate or conflicting blocks from plugins, colliding @id values, HTML entities in JSON-LD. Use when someone asks to validate schema markup, test structured data, debug "structured data present" or "structured data invalid" audit findings, find why Rich Results Test or schema validator shows errors, or untangle duplicate schema from Yoast, Rank Math or a theme. Covers tech.structured-data-present and tech.structured-data-valid. Uses the aeo-visibility MCP server if connected; works without it.
---

# Validating structured data

Two audit rules, two different questions: is there any structured data at all, and is what
exists well formed enough to be used. Most "invalid" results come from a handful of mechanical
causes (a stray comma, two plugins, an entity in a string) and are quick to fix once you know
where the block comes from.

## When this matters / when it doesn't

**It matters** when markup exists but is not being parsed, or when several sources emit
overlapping markup. Broken markup is ignored, which is worse than none because the page looks
covered.

**Passing the audit is a low bar.** The audit checks a small set of required properties on
a short list of types. A page can pass every structured-data rule and still contain markup
that does not match the visible content, which Google's guidelines forbid and which no
validator detects. Valid is not the same as true.

**Do not chase warnings for their own sake.** Google says fewer, complete and accurate
recommended properties beat many badly formed ones. Missing recommended properties are not
errors.

**Rich result eligibility is a different question.** Several Google rich result types have been
deprecated (see `aeo-faq-qa-schema`), so a clean Rich Results Test may show no eligible
features even for perfect markup. Do not read "no rich results detected" as a markup bug.

## Detect

| Rule | Passes when |
|---|---|
| `tech.structured-data-present` | The total number of detected structured-data items across the crawled pages is greater than zero (JSON-LD, Microdata or RDFa all count). |
| `tech.structured-data-valid` | No detected item is marked invalid. With zero items it passes ("nothing to validate"). |

How the audit defines the words, from `packages/schema-validator`:

- **Present** means at least one *typed* node was extracted. JSON-LD in
  `<script type="application/ld+json">`, `@graph` members and top-level arrays are each
  flattened into items. A node with no `@type` produces no item.
- **A JSON-LD block that does not parse is counted as one invalid item.** So malformed JSON
  makes `present` pass (it is an item) and `valid` fail, with the warning "JSON-LD script
  contains invalid JSON and was skipped". A site with only broken markup therefore shows
  present-pass, valid-fail. Do not read the present-pass as "the markup works".
- **Valid** means every top-level item satisfies the required properties the validator defines
  for its type:

  | Type | Required by the toolkit |
  |---|---|
  | `Organization` | `name` |
  | `Person` | `name` |
  | `Article`, `NewsArticle`, `BlogPosting` | `headline` |
  | `BreadcrumbList` | `itemListElement` |
  | `Product` | `name` |
  | `Review` | `reviewRating` |
  | `LocalBusiness` | `name`, `address` (a plain string address warns) |
  | `FAQPage` | `mainEntity` of `Question` items with `acceptedAnswer` |
  | `QAPage` | `mainEntity` Question with `acceptedAnswer` or `suggestedAnswer` |
  | `HowTo` | `step` |

- **Any other type is treated as valid.** `TechArticle`, `WebSite`, `WebPage`, `Event`,
  `Recipe`, `VideoObject` and every other type pass without checks. "Valid" here means "no
  rule defined was broken", not "complete".
- Only **top-level** items are validated. A `Person` nested inside `author` counts for presence
  but is not itself checked for `name`.
- **Property names are matched case-insensitively**, which is more lenient than schema.org and
  Google. `Headline` passes the toolkit and can still be ignored elsewhere.
- Several types an item declares are validated together; a `["Product","Review"]` node must
  satisfy both.
- The toolkit's required lists are **its own** and differ from Google's. Google's Article
  documentation, for example, lists no required properties, while the toolkit requires
  `headline`. Both are right for their purpose; when they disagree, satisfy both.
- **What the audit does not detect:** duplicate blocks, `@id` collisions, markup that
  contradicts the page, `@id` references that point nowhere, wrong value types, and any
  Organization disagreement except through `aeo.entity-identity-consistent`.

With the MCP server: `analyze_website_aeo` and read both rules plus the structured-data detail
on the failing page.

Without it, the validator is a library (there is no CLI). Install it in a scratch directory and
run it over saved HTML:

```bash
curl -s https://example.com/page -o page.html
npm install @advance-labs/schema-validator
node --input-type=module -e "
import { analyzeStructuredData } from '@advance-labs/schema-validator';
import { readFileSync } from 'node:fs';
const r = analyzeStructuredData(readFileSync('page.html', 'utf8'), 'https://example.com/page');
console.log({ total: r.totalItems, invalid: r.invalidCount, types: r.typesPresent });
for (const i of r.items) console.log(i.format, i.type || '(unparsed)', i.valid ? 'ok' : 'INVALID', i.missingRequired, i.warnings);"
```

An `(unparsed)` item means invalid JSON; look at that block by hand. Fetch the page the way a
crawler does (no JavaScript), because the audit sees the served HTML; if the markup is only
injected client-side, `present` fails here even though Google's renderer might see it
(see `aeo-server-rendering`).

External validators, for a second opinion:

- **Rich Results Test** (https://search.google.com/test/rich-results): tests a URL or pasted code
  with Googlebot and shows which Google rich results the markup is eligible for. It only knows
  Google's supported features.
- **Schema Markup Validator** (https://validator.schema.org/): generic schema.org syntax and
  vocabulary check, independent of Google features. It is the better check for types Google
  has no feature for.
- Search Console's enhancement reports and the URL Inspection tool show what Google actually
  indexed after deployment (`gsc_url_inspect` if the aeo-search server is connected).

## Decide

| What you see | Cause to check first |
|---|---|
| `(unparsed)` item, "invalid JSON" | Trailing comma, comment, single quotes, unescaped quote or newline inside a string, smart quotes, template placeholder left in |
| Item invalid, `missingRequired` lists a prop | The property is absent or an empty string/array; often a template that outputs `""` when a field is blank |
| Same type appears twice with different values | Two emitters (SEO plugin + theme + page builder); pick one |
| Organization `@id`/`url` differ across pages or hosts | `aeo-organization-entity` |
| Two different nodes share one `@id` | Copy-pasted block, or an id built from a constant instead of the entity |
| Valid in toolkit, error in Google | Google requires more for that feature, or the feature is deprecated |
| Present only after JavaScript runs | Server-render it |
| Markup describes content not on the page | Remove or fix. This is a guideline violation, not a lint error |

## Implement

Fixes, by cause:

1. **Invalid JSON.** Find the block, run it through any JSON parser (`JSON.parse`), fix the
   reported position. Generate JSON-LD with `JSON.stringify` (or the language's encoder) from an
   object; do not build it by string concatenation.
2. **HTML entities inside the script.** A script body is not HTML-decoded. `&amp;`, `&quot;` and
   `&#39;` appear literally in the strings, and `\"` is the only way to include a quote. Write
   the real character. Escape `<` as `<` when the content is user-controlled, so a
   `</script>` in a string cannot break out of the tag.
3. **Missing required property.** Output the property from real data, or omit the whole node
   when the data does not exist. Do not emit empty strings.
4. **Duplicate and conflicting blocks.** Identify every source (view-source, search for
   `ld+json`; note which are inside the theme, which carry plugin signatures such as
   `yoast-schema-graph`). Keep one emitter per entity type. Disable the others rather than
   hand-merging. If the nodes are identical, duplication is harmless but wasteful; if they
   differ, it is the defect.
5. **`@id` collisions.** `@id` identifies a node, and Google's guidelines use `@id` to link
   related items. Two different things sharing an `@id` (for example the `WebPage` and the
   Organization both using `https://example.com/`) are ambiguous. Use distinct fragments:
   `/#organization`, `/#website`, `/page#webpage`, `/page#article`. A given `@id` should mean the
   same entity wherever it appears, and different entities should never share one.
6. **Wrong value types.** Dates as ISO 8601, `url`/`image` as absolute URLs, numbers as
   numbers when a number is expected, `sameAs` as an array of URL strings.
7. **Prefer JSON-LD.** Google supports JSON-LD, Microdata and RDFa equally if valid, and
   recommends JSON-LD where the setup allows. Do not convert working Microdata for its own sake.
   Mixing JSON-LD and Microdata for the same entity is where duplicates and conflicts start.
8. **Keep it connected.** One `@graph` per page with stable `@id`s beats a pile of
   disconnected blobs. See `aeo-organization-entity` and `aeo-article-author-schema` for the
   node shapes.

Stack notes: `references/nextjs.md`, `references/wordpress.md`. Plain HTML and Astro have
no stack-specific causes beyond the above; see the recipes in the other schema skills.

## Verify

1. Re-run `analyze_website_aeo` or the validator script on each page type (home, article,
   product, FAQ). `tech.structured-data-present` and `tech.structured-data-valid` should
   pass, and no item should be `(unparsed)`.
2. Count the blocks: `curl -s URL | grep -c 'application/ld+json'`. It should equal the number
   you intend.
3. Run the Rich Results Test and the Schema Markup Validator on one URL per template. Errors
   must be zero; read warnings and decide.
4. Spot-check that markup matches the visible page.
5. After deployment, check Search Console for the same URL if available.

## Pitfalls

- **Validating the template, not the output.** Test the rendered HTML, not the source file.
- **Testing a pasted snippet instead of the live URL.** The live page may carry extra blocks.
- **Caching.** A CDN or page cache can serve old markup after the fix.
- **Staging identities.** `@id` and `url` generated from the request host publish preview
  domains.
- **Trusting the green tick.** Both the toolkit and the external tools check syntax and
  declared requirements, not truth.
- **Fixing warnings by adding invented data.**
- **Assuming a deprecated feature is a markup error.** See `aeo-faq-qa-schema`.

## Sources

- Google, intro to structured data (formats; Rich Results Test; JSON-LD recommended): https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data (verified 2026-11-13)
- Google, structured data general guidelines: https://developers.google.com/search/docs/appearance/structured-data/sd-policies (verified 2026-11-13)
- Google, Rich Results Test: https://search.google.com/test/rich-results (verified 2026-11-13)
- Schema Markup Validator: https://validator.schema.org/ (verified 2026-11-13, page loads; no description on the page)
- schema.org data model (`@id` in JSON-LD): https://schema.org/docs/datamodel.html (verified 2026-11-13)
- Toolkit: `packages/schema-validator/src/{validation,json-ld,analyze}.ts`, `packages/scoring/src/technical-seo-rules.ts` (read 2026-11-13)
