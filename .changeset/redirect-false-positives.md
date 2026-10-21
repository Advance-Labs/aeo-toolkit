---
'@advance-labs/crawler': patch
'@advance-labs/scoring': patch
---

Stop scoring ordinary redirects as redirect loops, and crawl the site where it actually lives.

`tech.no-redirect-loops` (critical) seeded its visited set with the page's own URL, but the crawler records that URL as the first hop of every redirect chain. Every page that redirected at all, including a plain http -> https or apex -> www hop, failed the rule. A loop is now a URL that answers with a redirect twice.

`crawl` now resolves the root first. When it redirects to the same site on another origin (http -> https, example.com <-> www.example.com), the crawl, robots.txt, sitemaps and link scope use that origin. Before, every link on the real pages was off-origin, so the crawl stopped after one page, and an http root scored as "not served over HTTPS". `CrawlResult.rootUrl` is the resolved root. A path-only redirect (`/` -> `/home`) or a redirect to another site keeps the requested URL.
