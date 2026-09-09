<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../../brand/logo-dark.png">
    <img src="../../brand/logo.png" alt="AEO Toolkit" width="280">
  </picture>
</p>

# Publishing to the Chrome Web Store

> **Status.** Published and live:
> [AEO/GEO Auditor](https://chromewebstore.google.com/detail/aeogeo-auditor/bdkkjpbipgolopjhndknigaaokdabnad).
> Item ID `bdkkjpbipgolopjhndknigaaokdabnad`. First approved 2 September 2026 as **v0.1.0**.
>
> **v0.1.0 is stale and should not be promoted.** It was packaged before two changes that are
> now on `main`, and both are visible to users:
>
> 1. **It runs the pre-#34 scoring engine.** Commit `603ab7c` fixed three bugs that mis-scored
>    correct markup, and a v0.1.0 audit of advancelabs.dev on 9 September 2026 still reported
>    all three: `alt=""` counted as missing alt text, plus breadcrumb and article-author
>    findings on a homepage, which is neither. It returned 89/B where the fixed engine returns
>    92/A on the same site. Shipping a scorer that fails correct markup is the one defect this
>    product cannot have.
> 2. **It carries the retired brand.** The sphere icon landed in `d804866`, after submission,
>    so the live tile is still the indigo/violet "A" that `brand/README.md` records as retired.
>
> **v0.2.0 fixes both.** Package it and upload before pointing any campaign at the listing.

This document describes how to package and submit the **AEO/GEO Auditor** MV3
extension to the [Chrome Web Store](https://chromewebstore.google.com/). The
extension is 100% client-side: every audit runs in the user's browser and the
only network calls are same-origin probes for `robots.txt` / `sitemap.xml` /
`llms.txt` on the page being audited. **No audit data, analytics, or telemetry
ever leaves the browser**, and there are no server calls, accounts, or API keys.

## 1. Build the store archive

```bash
pnpm --filter @advance-labs/chrome-extension package
```

This generates the brand icons (`pnpm icons`), runs `vite build` (producing `dist/`),
and then zips the build output into
`apps/chrome-extension/aeo-extension.zip` — the file you upload to the store.
The zip contains the `manifest.json` at its root (Chrome requires the manifest
at the archive root, which is why the script zips the *contents* of `dist/`,
not the `dist/` folder itself).

Verify before uploading:

```bash
cd apps/chrome-extension
unzip -l aeo-extension.zip   # manifest.json must be at the top level
```

## 2. Manifest sanity check

The packaged `manifest.json` is generated from
[`manifest.config.ts`](./manifest.config.ts). Confirm:

- `manifest_version` is `3`.
- `name` is `AEO/GEO Auditor` and the `description` is **at most 132 characters**. The store
  rejects longer ones. Check it rather than assuming:
  ```bash
  node -e "console.log(require('./dist/manifest.json').description.length)"
  ```
  (The shipped description was 162 characters until 2026-08-30 and would have been rejected.)
- `version` is bumped from the previously published version. The store rejects
  re-uploads of an already-published version number. Bump the `version` field in
  [`package.json`](./package.json); `manifest.config.ts` derives the manifest
  `version` / `version_name` from it automatically.
- `permissions` are minimal: `activeTab` + `scripting` (read the current tab's
  DOM only when the user clicks the icon).
- `host_permissions` is `<all_urls>` — required so the background worker can
  fetch the audited page's own `robots.txt` / `sitemap.xml` / `llms.txt`. Be
  ready to justify this in the store review (see the privacy note below).

## 3. Required listing assets

Prepare these before submission (the store will not publish without them):

| Asset | Spec | Notes |
| --- | --- | --- |
| **Extension icons** | 16×16, 32×32, 48×48, 128×128 PNG | Generated from the brand mark `src/icons/icon.svg` by `pnpm icons` (`scripts/generate-icons.mjs`, via `sharp`) into `public/icons/icon-{16,32,48,128}.png`; Vite copies `public/` into `dist/`, so they resolve at `dist/icons/*`. `manifest.config.ts` already wires the `icons` map and `action.default_icon` (16/48/128). The `package` script runs `icons` automatically, so the store zip always contains them. |
| **Store icon** | 128×128 PNG | The icon shown on the store listing page — `public/icons/icon-128.png`, the Advance Labs sphere rasterized at 128px (see `brand/README.md`). |
| **Screenshots** | 1280×800 or 640×400 PNG/JPEG, 1–5 images | Capture the popup: score gauge, the site-file (robots/sitemap/llms) grid, and the checklist. |
| **Small promo tile** (optional) | 440×280 PNG/JPEG | Improves discoverability. |
| **Marquee promo tile** (optional) | 1400×560 PNG/JPEG | Only needed for featured placement. |

## 4. Listing copy

The listing is a **discovery surface**, not just a description. Google indexes it, and
assistants read it when someone asks which tool audits a site for AI search. So the detailed
description is written answer-shaped: question headings, plain statements, and no number that
does not trace to a file in this repo.

House rules for this copy, which differ from the runbook prose around it: **no em dashes and no
exclamation marks** (see `brand/README.md`), and every claim stays inside what the shipped build
actually does.

### Numbers that are safe to state

Check these before each release rather than copying them forward:

| Claim | Where it comes from | Command |
|---|---|---|
| **40 checks** | `auditRules = [...technicalSeoRules, ...aeoRules]` in `packages/scoring/src/audit.ts` (29 + 11) | `grep -c "id: '" packages/scoring/src/{technical-seo,aeo}-rules.ts` |
| **9 categories** | distinct `category:` literals across those two files | `grep -rhoE "category: '[a-z-]+'" packages/scoring/src/{technical-seo,aeo}-rules.ts \| sort -u \| wc -l` |
| **0 to 100 score + letter grade** | `packages/scoring/src/grade.ts` | — |

Do **not** describe the extension as running 54 rules. That figure counts the 14 E-E-A-T
signals in `eeat-rules.ts`, which are a separate scorer that `auditRules` does not include and
the extension does not run. 54 is a true statement about the toolkit and a false one about this
build.

### Short description (≤132 chars)

The manifest `description` is the store's short description, so it is already under the cap and
generated from `manifest.config.ts`. Current text, 127 characters:

> Client-side AEO/GEO audit of the active tab: meta, structured data, robots.txt, sitemap,
> llms.txt, AI-bot rules. Exports a PDF.

### Detailed description

```text
Audit any page for how well it answers to AI search, in one click, without sending the page
anywhere.

AEO/GEO Auditor runs 40 checks across 9 categories against the tab you are looking at, then
gives you a 0 to 100 AI-readiness score with a letter grade and a filterable list of what to
fix. Every check runs inside your browser.

WHAT IS AEO, AND HOW IS IT DIFFERENT FROM SEO?

Answer Engine Optimization is what decides whether ChatGPT, Perplexity, Claude, and Google's
AI Overviews can read your page, understand it, and cite it. Classic SEO gets you ranked in a
list of links. AEO gets you quoted in an answer. The signals overlap but they are not the
same: an answer engine cares about whether your markup identifies who wrote something, whether
your content is extractable as discrete answers, and whether your robots.txt lets its crawler
in at all.

WHAT IT CHECKS

Crawlability. robots.txt rules, and specifically whether AI crawlers such as GPTBot,
PerplexityBot, and ClaudeBot are permitted or blocked.

Crawl hints. sitemap.xml presence and whether its lastmod dates are trustworthy, plus llms.txt,
the emerging convention for telling answer engines what a site is about.

Structured data. JSON-LD validity, and whether Organization, Article with a Person author,
FAQPage, BreadcrumbList, and Speakable markup are present. Nested @graph structures are read at
any depth, so markup done the way Google documents it is scored correctly.

Indexing and metadata. Canonicals that point somewhere real, unique titles, title and
description length, one H1 per page, valid heading hierarchy, declared language.

Answer engine optimization. Whether headings are question-shaped, whether content is answerable
with enough depth, whether Organization identity is consistent across pages, and whether the
page is extractable as paragraphs plus lists and tables.

Content, social, mobile, security. Alt-text coverage that understands alt="" is the correct
markup for a decorative image, internal linking, thin-content detection, OpenGraph and Twitter
Card completeness, viewport, and HTTPS.

Checks that do not apply to a page are dropped rather than failed. A homepage is the root of a
breadcrumb trail and is not an article, so it is not marked down for lacking either.

PRIVACY

Nothing leaves your browser. There is no account, no server, no analytics, and no telemetry.
The only network requests are to the audited site's own robots.txt, sitemap.xml, and llms.txt,
which is why the extension asks for host permissions. Your audit history is not stored anywhere
because it is not stored at all.

EXPORT

Export any audit as a PDF, generated locally, for handing to a client or a colleague.

OPEN SOURCE

The scoring engine is Apache-2.0 licensed and public at
github.com/Advance-Labs/aeo-toolkit. Every check is a rule you can read.

Built by Advance Labs.
```

- **Category**: Developer Tools.
- **Language**: English.
- **Privacy policy URL**: `https://advancelabs.dev/privacy/aeo-auditor` (live; the page exists
  at `web/src/app/privacy/aeo-auditor/page.js` in the `advance-labs` repo).
- **Homepage URL**: `https://advancelabs.dev/tools/aeo-auditor`.

## 5. Privacy disclosures (Web Store review)

The store requires a privacy section. Use these answers:

- **Single purpose**: "Analyze the active tab for AI/answer-engine readiness
  (AEO/GEO) and present a score with actionable fixes."
- **Permission justifications**:
  - `activeTab` / `scripting`: read the live DOM of the tab the user explicitly
    audits, only when they click the toolbar icon.
  - `host_permissions: <all_urls>`: fetch the audited origin's own `robots.txt`,
    `sitemap.xml`, and `llms.txt` to evaluate crawlability. No third-party hosts
    are contacted.
- **Data usage**: declare that the extension does **not** collect or transmit any
  user data. All analysis is performed locally in the browser; there are no
  remote endpoints, no analytics, and no telemetry. You can truthfully check
  "does not sell or transfer user data" and "does not use data for unrelated
  purposes."
- **Privacy policy URL**: `https://advancelabs.dev/privacy/aeo-auditor`. This is live and is
  the page the store review reads; it is served from `web/src/app/privacy/aeo-auditor/page.js`
  in the `advance-labs` repo. Do not substitute the GitHub README, which is not a privacy
  policy and has been rejected as one before.

## 6. Submit

1. Sign in to the
   [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   (one-time US$5 registration fee for the developer account).
2. Click **Add new item** and upload `aeo-extension.zip`.
3. Fill in the listing copy, upload the icons and screenshots, and complete the
   **Privacy practices** tab using the answers above.
4. Submit for review. MV3 extensions that request `<all_urls>` typically receive
   extra scrutiny; the local-only privacy posture above is the key justification.
5. After approval, bump the `version` in `package.json` for the next release and
   re-run `pnpm --filter @advance-labs/chrome-extension package` to produce the next zip.

---

## 7. Published state, and the trap that caught v0.1.0

**Live since 2026-09-02**: item `bdkkjpbipgolopjhndknigaaokdabnad`. The canonical link is
`https://chromewebstore.google.com/detail/bdkkjpbipgolopjhndknigaaokdabnad` — the store's own
share button appends `?utm_source=item-share-cp`; drop it. The URL is held once in each repo:
`CHROME_STORE_URL` in `apps/console/src/lib/seo.ts` here, and `CHROME_STORE` in
`web/src/content/site.js` in the `advance-labs` repo (where it is also an `ORG.sameAs` entry).

**The store is publish-once. A green `main` ships nothing.**

v0.1.0 was uploaded on 2026-08-30 at 09:58. The three scoring accuracy fixes in `603ab7c`
(ADV-173 nested `@graph`, ADV-174 decorative `alt=""`, ADV-175 page-type-aware rules) landed
2026-08-31 at 22:01 — *after* the upload. The published extension therefore spent its whole
shelf life telling people with correct markup that it was wrong, which is the single worst
failure mode this tool has. Nothing surfaced it, because:

- `main` was fixed, so the repo looked correct;
- `dist/` had been rebuilt afterwards, so a local check looked correct;
- only the **zip's** contents — the artifact Google actually holds — told the truth.

So, before every upload:

```bash
pnpm --filter @advance-labs/chrome-extension package
cd apps/chrome-extension && unzip -l aeo-extension.zip   # manifest.json at the ROOT
```

and confirm the archive is newer than the last commit touching `packages/scoring`,
`packages/schema-validator`, or `packages/html-parser` — the extension bundles their built
output, so a stale workspace `dist/` silently ships fixed bugs.

`src/lib/audit.integration.test.ts` is the standing guard: it runs the **real** (unmocked)
parser → validator → scoring chain that the bundle contains, and fails if either of the two
observable ADV-173/174 behaviours regresses. `audit.test.ts` mocks those packages by design and
cannot catch this.

The report version is derived from `package.json` (`EXTENSION_VERSION` in `src/lib/audit.ts`),
so bumping the version in one place is enough. It was hardcoded until 0.1.1 and would have
stamped `0.1.0` into every 0.1.1 PDF.
