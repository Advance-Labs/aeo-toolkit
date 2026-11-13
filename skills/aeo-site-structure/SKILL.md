---
name: aeo-site-structure
description: Fix breadcrumbs and internal linking so crawlers and answer engines can find pages and understand how the site is organised. Use when someone asks to add breadcrumbs or BreadcrumbList schema, why breadcrumbs don't show in Google, how to improve internal linking, how to find orphan pages, which pages should link to which, how to build a topic hub or pillar page, or when an audit fails aeo.breadcrumbs, eeat.auth.breadcrumbs, tech.internal-linking or eeat.auth.internal-linking. Uses the aeo-visibility MCP server if connected; works without it.
---

# Site structure: breadcrumbs and internal links

Two things tell a crawler how a site fits together: the links between pages, and (optionally) a
breadcrumb trail. Links matter far more. Breadcrumbs are a small, specific addition for pages that
sit inside a real hierarchy.

## When this matters, and when it doesn't

- **Breadcrumbs** make sense on pages deep in a hierarchy: product in category in shop, article in
  section, doc page in guide. They do not make sense on a homepage (it is the root; a one-item trail
  pointing at itself is noise) or on flat sites where every page is top level. The audit skips
  `aeo.breadcrumbs` on a single-root-page audit for that reason. Do not invent a hierarchy to
  satisfy the check.
- Google's breadcrumb documentation says the feature is available on desktop. Do not promise
  breadcrumb display in mobile results, and do not promise any display at all; markup makes a page
  eligible, it does not guarantee a rich result.
- **Internal links** matter on every site with more than a handful of pages. They are how Google
  discovers pages ("Google can only crawl your link if it's an `<a>` element with an `href`") and
  how both people and machines learn which pages relate.
- For a five-page brochure site, internal linking is a non-issue. Say so.

## Detect

What the audit checks (`packages/scoring`, `packages/schema-validator`, `packages/html-parser`):

| Rule | Passes when |
|---|---|
| `aeo.breadcrumbs` | Any audited page has a `BreadcrumbList` in structured data (JSON-LD, microdata or RDFa). Not applied to a single-root-page audit |
| `eeat.auth.breadcrumbs` | The same signal, counted as an E-E-A-T authority signal |
| `tech.internal-linking` | Mean internal links per page is 1 or more |
| `eeat.auth.internal-linking` | Mean internal links per page is 3 or more |

What these checks do **not** measure, and you should not claim they do:

- **Breadcrumb checks only look for the presence of a `BreadcrumbList`.** They do not compare it with
  the visible breadcrumb, check `position` values, check that URLs resolve, or check that the trail
  is sensible. One page with a breadcrumb passes the whole site.
- **Internal link count counts every `<a href>` that points to the same host**, excluding bare
  `#fragment` links. Navigation, header, footer and sidebar links all count. A site whose pages
  have a 10-link menu passes both link rules with zero contextual links. A pass says the site is
  not a link desert; it does not say the linking is good.
- **There is no orphan-page detection.** The audit never checks whether a page is linked from
  anywhere. Finding orphans takes the manual steps below.
- It samples the crawl (the MCP tool crawls up to 10 pages) and averages across them.

**With the MCP server.** `analyze_website_aeo` returns `topFixes` that include `aeo.breadcrumbs`
if it failed (it sits in the aeo category). It does not list `tech.internal-linking` as a top fix
unless it fails; the E-E-A-T rules are not in its summary at all. For indexing status of suspected
orphans, call `gsc_url_inspect` on up to 25 URLs and read `coverageState`.

**Without it.** Check breadcrumbs:

```bash
curl -sL https://example.com/shop/shoes/runner | grep -c 'BreadcrumbList'
curl -sL https://example.com/shop/shoes/runner | grep -oE '"@type"\s*:\s*"BreadcrumbList"'
```

Find orphans on a small site: take the sitemap URLs, and for each one search the other pages for a
link to it. A URL that appears in the sitemap but is linked from no page (other than itself) is an
orphan.

```bash
# URLs in the sitemap
curl -sL https://example.com/sitemap.xml | grep -oE '<loc>[^<]+' | sed 's/<loc>//' > /tmp/urls.txt
# For one URL, how many sitemap pages link to it?
target=/guides/pricing
while read u; do curl -sL "$u" | grep -q "href=\"$target\"" && echo "$u"; done < /tmp/urls.txt | wc -l
```

On larger sites use a crawler that reports inlinks per URL and filter for zero or one.

## Decide

**Orphans: link them or retire them.** A page nobody links to is rarely discovered by Google except
via the sitemap, and tells engines the site considers it unimportant. For each orphan, ask:

| Orphan is | Do |
|---|---|
| A page that should exist and rank | Link it from relevant pages (see Implement) |
| A near-duplicate of another page | Do not link it. Consolidate. Check `seo-cannibalization` first |
| Old, replaced content | Redirect or remove deliberately, with the owner's say-so. Never delete by reflex |
| An intentionally unlinked page (landing page for ads, thank-you page) | Leave it. Say it is not a problem |

**Hubs.** If the site has many pages on one subject, one page should act as the hub: it links to
each of them and each links back. Only build a hub where the content really clusters. Do not
manufacture hub pages to chase a check.

**Breadcrumb vs URL.** Google recommends breadcrumbs that represent a typical user path to a
page, not a mirror of the URL structure. If a product lives in two categories, pick the usual
path or mark up more than one trail. A trail must match the breadcrumb a visitor can see; ask what
the visible trail is before writing the markup.

## Implement

### Internal links

1. Use real anchors: `<a href="/guides/pricing">`. Links built from `onclick`, `<span>` or a
   `javascript:` href are not reliably crawled.
2. Write descriptive anchor text: "pricing for small teams", not "click here" or a bare URL. Image
   links use the image's `alt` as anchor text, so give it one.
3. Add contextual links inside body copy where a reader would want them: from a general guide to
   the detailed page, from a comparison to each product page, from old posts to a newer, better
   one. Two to five relevant links per substantial page is a reasonable range; this is a guideline,
   not a measured threshold. Do not add links for volume.
4. Link up and across the hierarchy: child to parent, siblings to siblings, hub to children.
5. Put new pages in at least one existing, crawled page the day they are published (a hub, a
   "related" block, the blog index). Do not rely on the sitemap alone.
6. Keep links in the server-sent HTML. Google can process JavaScript-inserted anchors that use
   proper `<a href>`, but other crawlers may not.

### Breadcrumbs

1. Render a visible breadcrumb trail in the page: an `<ol>` of links, last item the current page.
2. Add `BreadcrumbList` JSON-LD that mirrors it. Per Google, define at least two `ListItem`s, each
   with `position` (1 is the start), `name` (the label users see) and `item` (the URL). `item` is
   not required on the last item, since Google uses the page's own URL. You do not need an item for
   the homepage or for the page itself.

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Shop",  "item": "https://example.com/shop" },
    { "@type": "ListItem", "position": 2, "name": "Shoes", "item": "https://example.com/shop/shoes" },
    { "@type": "ListItem", "position": 3, "name": "Runner" }
  ]
}
```

3. Generate both the visible trail and the JSON-LD from one data source so they cannot drift.
   If you cannot say what the visible trail is, do not add markup for it.
4. Do not add breadcrumbs to the homepage.

Per-stack: Next.js, Astro and WordPress all have an obvious layout or SEO-plugin place for this.
Next.js and Astro: build the trail in the page layout from route data and emit the JSON-LD as a
`<script type="application/ld+json">`. WordPress SEO plugins (Yoast, Rank Math and others) can
output visible breadcrumbs via a theme function or block plus matching schema; check the plugin's
breadcrumb setting is enabled and the theme actually calls it.

## Verify

1. Re-run `analyze_website_aeo` and confirm `aeo.breadcrumbs` is not in `topFixes`. Remember the
   check passes on one page.
2. Test one page in Google's Rich Results Test and confirm the BreadcrumbList parses without
   errors. Then compare the markup to the visible trail by eye.
3. Re-run the orphan check. Each previously orphaned page that should exist now has an inlink.
4. After the next crawl, `gsc_url_inspect` on the formerly orphaned URLs to see `coverageState`.
   Google decides when to crawl and index; do not expect an immediate change.

## Pitfalls

- **Breadcrumb markup that does not match the visible page.** Mark up what is visible.
- **Mirroring the URL path instead of the user path.** Google recommends the latter.
- **Adding breadcrumbs to flat sites or the homepage** to turn a check green.
- **Counting nav links as internal linking.** The audit does; you should not.
- **Stuffing links.** Hundreds of footer links add count and no meaning.
- **Linking orphans that should be consolidated.** Check for duplication first.
- **Making links with JavaScript handlers.** Use real `<a href>`.
- **Promising rich results.** Eligibility is not display.

## Sources

- Google Search Central, Breadcrumb structured data (required properties, at least two ListItems, `item` optional on last item, typical user path not URL structure, available on desktop): https://developers.google.com/search/docs/appearance/structured-data/breadcrumb, verified 2026-11-13
- Google Search Central, Link best practices (crawlable `<a href>`, descriptive anchor text, image alt as anchor text): https://developers.google.com/search/docs/crawling-indexing/links-crawlable, verified 2026-11-13
- Google Search Central, AI features and your website (structured data should match visible text): https://developers.google.com/search/docs/appearance/ai-features, verified 2026-11-13
- Rule source: `packages/scoring/src/aeo-rules.ts`, `technical-seo-rules.ts`, `eeat-rules.ts`; `packages/html-parser/src/links.ts`; `packages/schema-validator/src/analyze.ts`, read 2026-11-13
