---
name: aeo-indexability
description: Find and fix reasons search and answer engines cannot index or trust a site's pages. Use when someone asks "why isn't my page indexed", "sitemap missing pages", "noindex by mistake", "canonical points to a 404", "redirect loop", "redirect chain", "broken pages", "hreflang errors", "submit to Google and Bing", "IndexNow", or when the audit fails tech.sitemap-present, tech.sitemap-covers-pages, tech.indexable, tech.canonical-present, tech.canonical-resolves, tech.no-broken-pages, tech.no-redirect-loops, tech.short-redirect-chains, tech.hreflang-valid or tech.https. Covers per-engine submission (Google, Bing, IndexNow). Uses the aeo-search MCP server if connected; works without it.
---

# Indexability

A page cannot be cited from an index it is not in. This skill covers the plumbing: sitemaps,
noindex, canonicals, redirects, broken pages, hreflang and HTTPS, plus how to tell each search
engine about changes. Several of these checks are blunt, so decide with the user before
"fixing" something that may be deliberate.

## When this matters / when it doesn't

It matters when pages the owner wants found are missing from Google or Bing, or the audit
reports crawl and index failures.

Do not "fix" these without asking:

- **`noindex` on purpose**: login, checkout, thank-you pages, internal search, staging, tag
  archives. The audit already treats a noindex page that the sitemap does *not* list as
  deliberate. It flags noindex on the home page, on pages the sitemap *does* list, or on any
  page when there is no sitemap to show intent.
- **A cross-domain canonical.** Pointing at another host is a legitimate way to consolidate
  (for example a proxied path whose canonical is the original). The audit does not flag it;
  neither should you.
- **No hreflang.** A single-language site has nothing to validate and the rule passes.
- **A tiny site with no sitemap.** Not required, but cheap and worth adding.

## Detect

Rules owned, with the real thresholds from `packages/scoring/src/technical-seo-rules.ts`:

| Rule | Fails when |
|---|---|
| `tech.sitemap-present` | no `/sitemap.xml` file and no sitemap entries found (a sitemap named in robots.txt counts if the crawler reads entries from it) |
| `tech.sitemap-covers-pages` | a sitemap exists, the crawl found more than one page, and **under 90%** of crawled indexable HTML pages are listed (a page counts as covered if its canonical is listed) |
| `tech.indexable` | `noindex` (meta or `X-Robots-Tag`) on the home page, on a page the sitemap lists, or on anything when there is no sitemap |
| `tech.canonical-present` | an indexable page has no `<link rel="canonical">` |
| `tech.canonical-resolves` | a canonical is relative or malformed, or points at a URL the crawl saw return 4xx/5xx |
| `tech.no-broken-pages` | any crawled URL returns 4xx/5xx |
| `tech.no-redirect-loops` | a URL's redirect chain answers twice from the same URL (a cycle) |
| `tech.short-redirect-chains` | a chain has **more than 2** hops |
| `tech.hreflang-valid` | an hreflang value is not a valid language[-script][-region] tag or `x-default`, or a same-host target was not reached by the crawl |
| `tech.https` | the site was not reached over HTTPS |

`tech.sitemap-lastmod-trustworthy` is related but belongs to `aeo-content-freshness`.

With the MCP servers:

1. `analyze_website_aeo` for the rule results and affected URLs.
2. `list_gsc_sites`, then `gsc_url_inspect` for **definitive Google status** (up to 25 URLs per
   call, about 2,000 inspections per property per day). It returns verdict, coverageState,
   lastCrawlTime, googleCanonical and userCanonical. It is read-only: Google offers no API to
   request indexing. Compare `googleCanonical` with `userCanonical`; if Google chose a
   different canonical than you declared, that is the finding.
3. For Bing, `bing_index_health` (crawl stats, issues, URL-submission quota, single-URL status
   with `url`). **Known caveat:** its `isPageIndexed` field is always false because Bing's
   response omits it. Judge by `DocumentSize > 0` instead.
4. `compare_engines` and `engine_divergence` to see where Google and Bing disagree. A page that
   gets impressions on Google and none on Bing is a Bing coverage problem, not necessarily a
   content problem.

Without MCP:

```bash
curl -sI https://example.com/page | grep -iE "^HTTP|location|x-robots-tag"   # status, redirect, header noindex
curl -s  https://example.com/page | grep -iE "rel=\"canonical\"|name=\"robots\"|hreflang"
curl -sIL -o /dev/null -w "%{num_redirects} hops, final %{url_effective}\n" http://example.com/page
curl -s https://example.com/sitemap.xml | grep -c "<loc>"
```

Search Console's Page indexing report and URL Inspection are the manual equivalents.

## Decide

Work from the worst to the least:

1. **HTTPS and redirect loops first.** A loop makes a page unreachable. HTTP not redirecting
   to HTTPS splits signals.
2. **Accidental noindex.** Ask: "Is this page meant to be in search?" A framework default or a
   staging setting that shipped is the usual cause.
3. **Broken pages and bad canonicals.** Decide per URL: restore it, 301 it to the closest
   replacement, or remove links to it. Never 301 everything to the home page; engines treat
   irrelevant redirects like soft 404s.
4. **Sitemap coverage.** Missing pages usually mean the sitemap is hand-written or generated
   from a stale list. Fix the generator, not the file.
5. **Redirect chains.** Make each old URL go to the final URL in one hop, and update internal
   links to the final URL.
6. **hreflang.** Only if the site is actually multilingual. Each page needs reciprocal tags and a
   self reference; values must be valid codes.

## Implement

Stack-agnostic shape:

- **Sitemap:** generate it from the same content list that builds the site. List only canonical,
  indexable, 200 URLs. Reference it from robots.txt (`Sitemap: https://example.com/sitemap.xml`).
  One file holds up to 50,000 URLs or 50MB uncompressed; beyond that use a sitemap index. Google
  ignores `<priority>` and `<changefreq>` and uses `<lastmod>` only if it is consistently
  accurate, so set `lastmod` from real content edits, not build time.
- **Canonical:** one absolute `https://` URL per page, self-referencing on the preferred
  version. Redirects and canonicals both signal the preferred URL; do not contradict them.
- **noindex:** remove from pages meant to be found. For non-HTML files use the
  `X-Robots-Tag` header. A page blocked in robots.txt cannot show its noindex, so do not combine
  `Disallow` with the intent to deindex.
- **Redirects:** 301/308 for permanent moves, one hop, to the final URL.
- **HTTPS:** redirect all HTTP to HTTPS at the host or CDN and set HSTS once you are sure.

Per-stack recipes: `references/nextjs.md`, `references/astro.md`, `references/wordpress.md`,
`references/static-html.md`.

### Telling each engine

Channels differ. Pick the right one, and do not overpromise.

| Engine | What to use | What not to expect |
|---|---|---|
| Google | Submit the sitemap in Search Console (Sitemaps report) and keep it in robots.txt. `gsc_url_inspect` to check status. "Request indexing" in the Search Console UI for single URLs. | Google says sitemap submission is **only a hint**, with no guarantee it will be downloaded or used. Google **does not take IndexNow**: it is not among the participating engines. The sitemap "ping" endpoint was announced as going away (June 2023); do not use it. The Indexing API is **only for pages with JobPosting or BroadcastEvent (in a VideoObject) markup**; using it for ordinary pages is outside its stated purpose. |
| Bing | Verify the site in Bing Webmaster Tools, submit the sitemap, and use IndexNow for changes. | IndexNow tells Bing a URL changed; it does not guarantee indexing. |
| Yandex, Naver, Seznam, Yep, Amazon | IndexNow | Participation is per the IndexNow FAQ; a single submission is shared to all participating engines. |

**IndexNow** works by hosting a key file you control and sending the changed URL(s) to one
endpoint (`https://api.indexnow.org/indexnow` or Bing's own). Only submit URLs that actually
changed, and submit deletions too.

**Why Bing is worth checking.** Microsoft Copilot and Bing's AI answers draw on Bing's index,
and Bing Webmaster Tools has an AI Performance report for Copilot and Bing citations. Many
write-ups also claim ChatGPT search uses Bing's index. **That claim could not be confirmed from
OpenAI's own documentation**, which describes its own search crawler, `OAI-SearchBot` (see
`aeo-ai-crawler-access`). Say "ChatGPT may draw on Bing" at most, and do not build a plan on it.
Bing coverage is worth fixing for Copilot and Bing alone.

## Verify

1. Re-run `analyze_website_aeo`. The owned rules pass, or the remaining failures are the ones the
   user chose to keep, and you can name them.
2. `gsc_url_inspect` on the fixed URLs after Google has had time to recrawl (days to weeks, not
   minutes). Expect `verdict: PASS`-style indexed status, `googleCanonical` equal to `userCanonical`.
3. `bing_index_health` with `url`, then `DocumentSize > 0`. Do not read `isPageIndexed`.
4. `engine_divergence` or `compare_engines` a few weeks later. The Google-vs-Bing gap for the fixed
   pages should narrow.
5. Spot-check redirects: `curl -sIL` shows one hop and a 200 at the end.

## Pitfalls

- Reading "Discovered, currently not indexed" or "Crawled, currently not indexed" as a technical
  fault. Those can be quality or priority decisions. Do not "fix" them by resubmitting.
- Submitting the same URL to every channel repeatedly. It does nothing extra and can hit quotas.
- A sitemap that lists redirected, noindex or 404 URLs. It tells engines two things at once.
- Build-time `lastmod` on every entry. It teaches crawlers to ignore the field.
- `Disallow` plus `noindex`: the crawler never fetches the page, so never sees the noindex.
- Changing the domain or moving to HTTPS without redirecting every URL and updating canonicals.
- Treating Search Console data as instant. It lags, and "URL is on Google" can differ from
  "page was recrawled after your fix".
- A staging `X-Robots-Tag: noindex` set in a shared CDN rule that also covers production.
- Using `bing_index_health.isPageIndexed`. It is always false.

## Sources

- Google, build and submit a sitemap (size limits, lastmod, submission is a hint): https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap (verified 2026-11-13)
- Google, "Sitemaps ping endpoint is going away" (June 2023): https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping (verified 2026-11-13, title only; body not read)
- Google Indexing API (JobPosting and BroadcastEvent only): https://developers.google.com/search/apis/indexing-api/v3/quickstart (verified 2026-11-13)
- Google, canonicalization methods: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls (verified 2026-11-13)
- Google, noindex: https://developers.google.com/search/docs/crawling-indexing/block-indexing (verified 2026-11-13)
- Google, localized versions (hreflang): https://developers.google.com/search/docs/specialty/international/localized-versions (verified 2026-11-13)
- Google Search Console API limits (URL Inspection 2,000 QPD and 600 QPM per site): https://developers.google.com/webmaster-tools/limits (verified 2026-11-13)
- IndexNow documentation and FAQ (participating endpoints: Amazon, Bing, Naver, Seznam.cz, Yandex, Yep; Google not listed): https://www.indexnow.org/documentation and https://www.indexnow.org/faq (verified 2026-11-13)
- Bing AI Performance in Webmaster Tools: https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview (found in search 2026-11-13; page not fetched)
- "ChatGPT search uses Bing": not verified against any OpenAI primary source.
- Toolkit rule implementation: `packages/scoring/src/technical-seo-rules.ts`.
