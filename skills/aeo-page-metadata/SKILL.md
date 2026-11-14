---
name: aeo-page-metadata
description: Fix and prioritise page titles, meta descriptions, Open Graph and Twitter cards, lang, charset, viewport and image alt text. Use when someone asks to improve or rewrite title tags or meta descriptions, why Google shows a different title than the one they wrote, whether title length matters, why a shared link has no preview image, how to add og:image or twitter:card, which titles to rewrite first, or when an audit fails tech.meta-title-present, tech.meta-title-length, tech.meta-description-present, tech.meta-description-length, tech.unique-titles, tech.open-graph-complete, tech.twitter-card, tech.lang-declared, tech.charset-declared, tech.viewport-mobile, tech.image-alt-coverage or eeat.trust.og-completeness. Uses the aeo-visibility and aeo-search MCP servers if connected; works without them.
---

# Page metadata

Title, description, social tags and a few document basics. Each is cheap to fix, and most are
check-the-box hygiene with one exception: the title and description decide whether a person
clicks a result, so they are worth real writing time on the pages that get seen.

## When this matters, and when it doesn't

- **Titles and descriptions** matter most on pages that already get impressions. Rewriting the
  title of a page nobody sees changes nothing. Prioritise by data (see Decide).
- **Length limits are heuristics.** Google says there is no limit on `<title>` or meta description
  length; results are truncated "as needed, typically to fit the device width". The audit's 30 to 60
  and 70 to 160 character bounds are sensible rules of thumb, not Google rules. A 68-character title
  that reads well is not a defect. Do not shorten good titles just to turn a check green.
- **Google may not use what you wrote.** It can generate its own title link from headings, anchor
  text or other page text, and it often builds snippets from page content instead of the meta
  description. Writing a better tag raises the odds; it does not control the output.
- **Social tags** matter if the pages are shared on social, chat or messaging apps. They exist for link previews and
  chat unfurls, so do not oversell them as an SEO lever.
- Alt text matters for accessibility first.

## Detect

What the audit actually checks (`packages/scoring`, `packages/html-parser`):

| Rule | Passes when |
|---|---|
| `tech.meta-title-present` | Every audited page has a non-empty `<title>` |
| `tech.meta-title-length` | Every page title is 30 to 60 characters inclusive |
| `tech.meta-description-present` | Every page has a non-empty meta description |
| `tech.meta-description-length` | Every description is 70 to 160 characters inclusive |
| `tech.unique-titles` | No two pages share a title (trimmed, case-insensitive). Multi-page audits only |
| `tech.open-graph-complete` | Every page has `og:title`, `og:description`, `og:image` and `og:url` |
| `eeat.trust.og-completeness` | At least half of pages pass the same OG check |
| `tech.twitter-card` | Every page has a `twitter:card` (via `name=` or `property=`) |
| `tech.lang-declared` | Every page has `<html lang="...">` |
| `tech.charset-declared` | Every page has `<meta charset>` or an `http-equiv` content-type charset |
| `tech.viewport-mobile` | Every page has a `viewport` meta tag |
| `tech.image-alt-coverage` | On each page, at least 80% of images that need alt text have it |

Details that change how you fix things:

- **Alt coverage** has three states. `alt="text"` is described. `alt=""` is declared decorative and is
  excluded from the calculation, which is correct for icons and spacers. A missing `alt` attribute
  counts against the page. Pages with no images pass. So the fix for a failing page is to add the
  attribute everywhere, using `alt=""` for decoration, not to write fake descriptions.
- **Open Graph** per the protocol has four required tags: `og:title`, `og:type`, `og:image` and
  `og:url`. The audit checks `og:description` instead of `og:type`. Add `og:type` anyway (usually
  `website` or `article`); the audit will not tell you it is missing.
- **Twitter** the audit only checks that `twitter:card` exists. Fallback from Twitter tags to Open
  Graph tags is described in secondary sources only; I could not verify it against X's current docs
  (see Sources). Set `twitter:card` explicitly, and set `twitter:title`, `twitter:description` and
  `twitter:image` too if you want no surprises.
- **Failing rules return URLs in the full audit, but the MCP summary does not.** `analyze_website_aeo`
  returns `topFixes` for the aeo, structured-data, content and metadata categories only, and no
  per-page URLs. That covers the title, description, lang and charset rules. It will **not** show
  `tech.open-graph-complete`, `tech.twitter-card`, `tech.viewport-mobile` or `tech.unique-titles`
  (social, mobile and indexing categories). The crawl is also capped at 10 pages.

**Without the MCP server**, spot-check with curl:

```bash
curl -sL https://example.com/page | grep -oiE '<(title|meta|html|link rel="canonical")[^>]*>?[^<]*' | head -40
```

For site-wide checks run a crawler of your choice or the scoring package against the crawl output.

## Decide

**Which titles and descriptions to rewrite first.** Use data, not the audit's length rules:

1. Call `list_gsc_sites`, then `gsc_ctr_gaps` (defaults: last 28 days, at least 100 impressions,
   CTR at or below 2%). It returns **queries**, not pages. Each row is a query people see you for
   and rarely click.
2. To find the page behind a query, call `gsc_search_analytics` with `dimensions: ["query","page"]`.
3. Check position before blaming the title. Below about position 10 to 15, a low CTR is mostly a
   ranking problem, and rewriting the title will not fix it. Page one with a low CTR is where a
   better title can help. `seo-high-intent-ctr` walks through this for buyer-intent queries.
4. Also check the SERP itself if you can: an AI Overview, featured snippet or ad block above you
   explains low CTR that no title can fix. Say when you cannot rule that out.
5. Group rows by page. One page, one rewrite.

Search Console cannot say whether the page's title is the cause. Say "likely" and offer to compare
CTR before and after.

**What a good title and description look like**, per Google's guidance: unique and descriptive per
page, concise, no keyword stuffing, no boilerplate that varies only by one word, brand mentioned
concisely, and matching the page's visible heading. Avoid half-empty titles (`| Site Name`) and
obsolete years in recurring pages ("2020 admissions" on a 2026 page). For descriptions, a short
accurate summary of the page, with concrete facts (price, author, what the page contains) where
useful. For big sites, generate descriptions programmatically from real page fields, but keep them
unique.

**Fixing duplicate titles** (`tech.unique-titles`): differentiate by what the page is about, not by
appending a number. If two pages cannot be told apart in a title, ask whether they should be one
page (check `seo-cannibalization`).

## Implement

Stack-agnostic shape:

1. Set the tags in one place, a layout or SEO component, with per-page data feeding it. Defaults
   in the layout cause the duplicate-title and missing-description failures.
2. Required document basics on every page: `<html lang>`, `<meta charset="utf-8">` early in `<head>`,
   `<meta name="viewport" content="width=device-width, initial-scale=1">`.
3. Open Graph: `og:title`, `og:type`, `og:image` (absolute URL), `og:url` (the canonical URL),
   plus `og:description`. Add `og:image:alt` if you set an image. Use a real per-page image where
   you can; a single shared site image is acceptable as a default.
4. `<meta name="twitter:card" content="summary_large_image">` plus the title, description and image.
5. Alt text: describe what the image shows in context, briefly. Use `alt=""` for decoration. Do not
   stuff keywords. Do not start with "image of".

Per-stack recipes: read the file for the project's stack.

- Next.js (App Router `metadata` and `generateMetadata`): `references/nextjs.md`
- Astro: `references/astro.md`
- WordPress (SEO plugin fields, theme): `references/wordpress.md`
- Plain HTML or other static sites: `references/static-html.md`

## Verify

1. Re-run `analyze_website_aeo` and confirm the metadata rules left `topFixes`. For the rules it
   does not summarize, re-check with curl on the affected pages.
2. View source (not DevTools) on a rendered page. The tags must be in the HTML the server sends.
   Tags injected by client-side JavaScript may never be seen by crawlers and link-preview bots.
3. Test a link preview with a sharing debugger from the platform in question.
4. For title rewrites: record the date and the before CTR for the page and query. After at least
   several weeks, compare in Search Console. Do not call a result from a few days of data.

## Pitfalls

- **Chasing length for its own sake.** The bounds are heuristics.
- **Rewriting titles on pages that rank on page two or worse.** Ranking comes first.
- **Same title or description sitewide.** The commonest bug, from a default in the layout.
- **`og:image` as a relative URL.** Use an absolute one.
- **Metadata that only exists after hydration.** Crawlers and preview bots see the raw HTML.
- **Fake alt text to hit 80%.** Use `alt=""` for decorative images instead.
- **Changing the title of a ranking page casually.** It can move CTR either way. Change deliberately
  and measure.
- **Updating a title or snippet and expecting immediate results.** Google recrawls on its own
  schedule and may keep its own rewrite.

## Sources

- Google Search Central, Influencing your title links (no length limit, truncation, unique and descriptive, boilerplate, half-empty and obsolete titles, Google may generate its own): https://developers.google.com/search/docs/appearance/title-link, verified 2026-11-13
- Google Search Central, Meta descriptions and snippets (no length limit, Google may use page content instead, unique per page): https://developers.google.com/search/docs/appearance/snippet, verified 2026-11-13
- Google Search Central, Image SEO best practices (descriptive alt text): https://developers.google.com/search/docs/appearance/google-images, verified 2026-11-13
- The Open Graph protocol (required tags `og:title`, `og:type`, `og:image`, `og:url`; `og:image:alt`): https://ogp.me, verified 2026-11-13
- X Twitter Cards markup reference: NOT verified. developer.x.com/en/docs/twitter-for-websites/cards/overview/markup now redirects to the generic X developer overview, and docs.x.com has no cards pages. The `twitter:card` requirement and OG fallback are from secondary sources; re-check when X republishes the reference (checked 2026-11-13)
- Rule source: `packages/scoring/src/technical-seo-rules.ts`, `eeat-rules.ts`; `packages/html-parser/src/meta.ts`, `images.ts`, read 2026-11-13
