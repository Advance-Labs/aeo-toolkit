---
name: seo-bing-coverage
description: Find where a site performs differently on Google and Bing, and check Bing crawl and index health. Use when someone asks "are we on Bing", "why did Google traffic drop but Bing didn't", "is Bing indexing our pages", "does Bing matter for ChatGPT or Copilot", "compare Google and Bing queries", or "submit our URLs to Bing / IndexNow". Requires the aeo-toolkit aeo-search MCP server with Google OAuth and a Bing Webmaster API key.
---

# Google vs Bing coverage

Google Search Console tells you how you do on Google. Bing Webmaster Tools tells you the
same for Bing, which also feeds Microsoft Copilot and is widely reported to be one of the
sources behind ChatGPT search. Comparing the two separates "Google ranking problem" from
"content or technical problem", and Bing exposes keyword data Google doesn't.

## When this matters / when it doesn't

- Matters: a traffic drop where you need to know if it is one engine or both; a site that
  is not verified in Bing at all; wanting AI-assistant visibility beyond Google.
- Matters less: sites whose Bing traffic is tiny. Divergence analysis needs volume (below).
  Bing may still matter for index presence even when its click share is small.

## Steps

1. **Check both properties exist.** `list_gsc_sites` and `list_bing_sites`. If the site is
   not in Bing Webmaster, stop and say so: nothing below works, and that is the finding.
   Verification is done by the owner in Bing Webmaster Tools; ask rather than assume. The
   Bing site URL can differ from the GSC property (`sc-domain:` form), so pass `bingSiteUrl`.
2. **Crawl and index health first.** `bing_index_health` with `siteUrl` (and `url` for a
   single page). It returns crawl stats (latest: crawled pages, in-index, 4xx, 5xx),
   crawl issues, URL-submission quota and, with `url`, single-URL info. Read `inIndex`
   against what you expect, and look at crawl issues before ranking questions.
3. **Compare queries.** `compare_engines` (`siteUrl`, `startDate`, `endDate`, `limit`)
   merges query rows from both engines with a `coverage` block saying whether each engine
   answered. A missing engine is `null` with a reason, never zero. **Bing rows are an
   unwindowed aggregate here: the date range applies to Google only.** So clicks are not
   like-for-like. Use it to see which queries exist on one engine and not the other,
   not to compare click counts.
4. **Find divergence.** `engine_divergence` (`siteUrl`, `startDate`, `endDate`, `threshold`
   default 0.3, `minClicks` default 50) splits the range into halves and classifies each
   query: `"google_specific"`, `"bing_specific"`, `"broad"`, or `"insufficient_data"`. Both engines
   are windowed here (Bing bucketed locally by row date). Use at least a few weeks so each
   half has volume. A 1-day range is rejected.
5. **Keyword gaps.** `bing_keyword_research` (`query`, optional `country`, `language` such
   as `en-CA`, which needs `country` too) returns impression and broad-match volume around
   a seed. Google Search Console has no equivalent. Treat as relative demand, not exact.
6. **Getting new pages seen by Bing.** IndexNow: host a key file on the site, then submit
   changed URLs (GET for one, JSON POST up to 10,000 URLs). Participating engines share
   submissions with each other. It is a notification, not a guarantee of indexing. Check
   `quota` in `bing_index_health` and the site's existing IndexNow setup before adding one.

## How to read the result

| Classification | Reading |
|---|---|
| `"google_specific"` | Held on Bing, dropped on Google. Suspect a Google ranking or indexing change. |
| `"bing_specific"` | Held on Google, dropped on Bing. Suspect Bing indexing or verification. |
| `"broad"` | Dropped on both. Suspect content or a technical problem. |
| `"insufficient_data"` | Baseline under `minClicks` on an engine, an engine unavailable, or no move past the threshold. |

`"insufficient_data"` is the expected answer for most of a long tail and for small sites. It
is not "no problem". Do not lower `minClicks` until something classifies; a 100% drop from
three clicks is noise. If every row is `"insufficient_data"`, report that the site is too
small on one engine to compare and fall back to `bing_index_health` and totals from
`bing_traffic_stats`.

## What it cannot tell you

- **Whether a page is indexed by Bing.** `bing_index_health` url info has an `isPageIndexed`
  field that is **always false** here because Bing's response omits it. Do not report "not
  indexed" from it. A `DocumentSize` above zero is the closest signal that Bing holds the
  page; say it is an inference.
- Why a page moved. Both engines show outcomes, not causes.
- How ChatGPT or Copilot choose sources. See below.

## Why Bing matters for AI assistants (and how sure we are)

OpenAI's crawler documentation states that sites blocking **OAI-SearchBot** do not appear in
ChatGPT search answers (they may still appear as links). Separately, many industry sources
report that ChatGPT search draws on Bing's index, but **we could not confirm that from an
OpenAI primary source**, so phrase it as "reported", not established. Microsoft Copilot is a
Microsoft product; its use of Bing is plausible but also not verified here. Practical
advice that holds either way: make sure Bing can crawl and index the site, do not block
Bingbot, and keep OAI-SearchBot allowed.

## Pitfalls

- Reading `compare_engines` click columns as a like-for-like comparison.
- Reporting "not indexed" from `isPageIndexed`.
- Treating `"insufficient_data"` as a clean bill of health.
- Passing the GSC `sc-domain:` string as the Bing site when Bing registered the `https://` form.

## Sources

- OpenAI crawler docs, https://platform.openai.com/docs/bots (OAI-SearchBot behaviour), verified 2026-11-13.
- IndexNow documentation, https://www.indexnow.org/documentation (10,000 URL limit, key file, cross-engine sharing), verified 2026-11-13.
- Tool behaviour from the aeo-search MCP tool definitions, verified 2026-11-13.
- ChatGPT-uses-Bing and Copilot-uses-Bing: secondary sources only, NOT verified.
