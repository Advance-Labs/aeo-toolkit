---
title: Chrome extension
description: >-
  AEO/GEO Auditor: the audit engine on your toolbar. What the 40 checks are, why that number is not 54, and what the extension does and does not send anywhere.
---

**[AEO/GEO Auditor](https://chromewebstore.google.com/detail/aeogeo-auditor/bdkkjpbipgolopjhndknigaaokdabnad)**
is the toolkit's scoring engine packaged as a Chrome MV3 extension. Open any page, click the
toolbar icon, and it returns a 0 to 100 AI-readiness score with a letter grade, a filterable
list of findings, and a PDF export.

- **Install:** [Chrome Web Store](https://chromewebstore.google.com/detail/aeogeo-auditor/bdkkjpbipgolopjhndknigaaokdabnad)
- **Product page:** [advancelabs.dev/tools/aeo-auditor](https://advancelabs.dev/tools/aeo-auditor)
- **Source:** [`apps/chrome-extension`](../../apps/chrome-extension)
- **Publishing runbook:** [`CHROME_STORE.md`](../../apps/chrome-extension/CHROME_STORE.md)

## Why it says 40 checks and the hosted audit says 54

Both numbers are right, and they describe different things. Quoting the wrong one either
overstates a free tool or understates a paid one, so it is worth being precise.

The extension runs `auditRules`, which is defined in
[`packages/scoring/src/audit.ts`](../../packages/scoring/src/audit.ts) as:

```ts
export const auditRules = [...technicalSeoRules, ...aeoRules];
```

That is **29 technical-SEO rules + 11 AEO rules = 40**, across 9 categories.

The **14 E-E-A-T signals** in
[`packages/scoring/src/eeat-rules.ts`](../../packages/scoring/src/eeat-rules.ts) are a separate
scorer with a different shape. They are not findings; they are weighted boolean signals grouped
into four pillars, and `auditRules` does not include them. 40 + 14 = 54, which is the figure the
hosted audit and the paid service quote because those do run both.

Verify rather than trust this page:

```bash
grep -c "id: '" packages/scoring/src/technical-seo-rules.ts packages/scoring/src/aeo-rules.ts
grep -rhoE "category: '[a-z-]+'" packages/scoring/src/{technical-seo,aeo}-rules.ts | sort -u | wc -l
```

## The 9 categories

| Category | Rules | What it looks at |
|---|---:|---|
| Crawlability | 8 | `robots.txt`, and specifically whether GPTBot, PerplexityBot and ClaudeBot are permitted. Sitemap presence, `lastmod` trustworthiness, redirect chains, broken pages. |
| Answer engine optimization | 11 | Question-shaped headings, answerable depth, Organization identity consistency, AI crawlers unblocked, `llms.txt`, extractability as paragraphs plus lists and tables. |
| Metadata | 7 | Title and description presence and length, exactly one H1, heading hierarchy, declared language. |
| Indexing | 4 | Indexability, declared canonical, canonicals that resolve, titles unique across pages. |
| Content | 4 | Alt-text coverage, internal linking, thin content, headings used structurally. |
| Social, mobile, security | 4 | OpenGraph, Twitter Card, mobile viewport, HTTPS. |
| Structured data | 2 | JSON-LD presence and validity, read recursively into `@graph`. |

## What it sends

Nothing about the page you audit.

Analysis runs against the live DOM in the tab you are already looking at. There is no account,
no server, no analytics, and no telemetry, and no audit is persisted because none is
transmitted. The only network requests the extension makes are to the audited origin's own
`robots.txt`, `sitemap.xml`, and `llms.txt`, which is what the `<all_urls>` host permission is
for and the thing to be ready to justify at store review.

The full statement is at
[advancelabs.dev/privacy/aeo-auditor](https://advancelabs.dev/privacy/aeo-auditor), which is the
URL the Chrome Web Store review reads.

## Three fixes worth knowing about

Version 0.2.0 corrected three cases where the engine failed markup that was correct. They are
listed here because if you audited a site with v0.1.0, these are the findings to re-check.

**`alt=""` is not missing alt text.** Under WCAG an empty `alt` is the prescribed markup for a
decorative image, so scoring it as absent told authors to introduce an accessibility regression.
Three states are now distinguished rather than two, and decorative images are excluded from both
sides of the coverage ratio.

**Typed nodes nested in an `@graph` are now visible.** The validator previously read only
top-level node types, so an `author: Person` inside an Article, which is the pattern Google
documents, was invisible. Types are collected recursively at any depth.

**Checks that do not apply are dropped, not failed.** A homepage is the root of a breadcrumb
trail and is not an article, so `aeo.breadcrumbs` and `aeo.article-author-schema` no longer fire
on one. Passing them would have been equally wrong: that would claim a check ran when it did not.

## Building it

```bash
pnpm --filter @advance-labs/chrome-extension package
```

That generates the icons, runs `vite build`, and zips `dist/` into
`apps/chrome-extension/aeo-extension.zip` with `manifest.json` at the archive root, which is
where Chrome requires it. To run an unpacked build, load `dist/` via `chrome://extensions` with
Developer mode on.

Icons are generated from `src/icons/icon.svg` by `scripts/generate-icons.mjs`. They composite
the Advance Labs sphere onto a rounded `#0A0A0B` tile rather than shipping it on transparency,
because the sphere is off-white with no outline and would otherwise be close to invisible on the
Chrome Web Store's white listing card and in the light-mode toolbar. See
[`brand/README.md`](../../brand/README.md) under "App icons".
