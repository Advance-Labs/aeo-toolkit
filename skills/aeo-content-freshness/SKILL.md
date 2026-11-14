---
name: aeo-content-freshness
description: Make a site's "last updated" signals honest and consistent, and decide which pages are worth a real refresh. Use when someone asks about dateModified, datePublished, "last updated" dates on posts, whether to bump dates to look fresh, sitemap lastmod values, a sitemap where every URL has today's date, future dates in a sitemap, or why an audit fails aeo.content-freshness or tech.sitemap-lastmod-trustworthy. Hands off to seo-content-decay to choose which pages to refresh. Uses the aeo-visibility and aeo-search MCP servers if connected; works without them.
---

# Content freshness, honestly

Freshness signals are the visible date on a page, the `dateModified` in its JSON-LD, and the
`<lastmod>` in the sitemap. Engines use them to decide what changed and what is worth fetching
again. They only help while they are true. This skill makes the three agree with reality, and
stops anyone "freshening" dates without freshening content.

## When this matters, and when it doesn't

It matters for content whose accuracy ages: pricing, regulations, tool comparisons, statistics,
how-tos for software, "best of" lists. A reader and an engine both want to know it is current.

It matters little for evergreen reference pages (a definition, a history, a recipe). An old date
on a page that is still correct is not a defect. The audit agrees: `aeo.content-freshness` checks
that a date exists and parses, not how recent it is.

**Never** change a date to make a page look newer when the content has not changed. Google's
people-first content guidance lists "changing the date of pages to make them seem fresh when the
content has not substantially changed" as a warning sign of content made for search engines first.
Adding or removing lots of content only to look fresh is another. Google's sitemap guidance says
that if `lastmod` does not match reality, "eventually we're not going to believe you anymore".

## Detect

| Rule | What it checks | Passes when |
|---|---|---|
| `aeo.content-freshness` | JSON-LD items of type Article, NewsArticle, BlogPosting, TechArticle or WebPage. For each it reads `dateModified`, falling back to `datePublished` | At least one such date exists and parses with `Date.parse` |
| `tech.sitemap-lastmod-trustworthy` | Sitemap `<lastmod>` values | See below |

How `tech.sitemap-lastmod-trustworthy` decides, exactly:

1. Fewer than 3 sitemap entries: passes, too few to judge.
2. No entry has a parseable `lastmod`: passes. `lastmod` is optional and is not penalized when absent.
3. **Fails** if any `lastmod` is more than 24 hours in the future.
4. **Fails** if every entry carries the identical timestamp and that timestamp is within the last 24
   hours. That is the signature of `new Date()` at build time.
5. Otherwise passes.

What the audit cannot tell you:

- It cannot tell whether a page really changed. Distinct-looking dates that are all invented pass.
- `aeo.content-freshness` passes with a `datePublished` alone, and does not compare JSON-LD with
  the visible date, so a mismatch is invisible to it.
- It does not check that `dateModified` is not earlier than `datePublished`.

So a green audit means "the signals exist and are not obviously broken", not "they are honest".
Do the consistency check yourself.

**With the MCP server.** `analyze_website_aeo` returns failed `aeo.content-freshness` in `topFixes`.
It does not list `tech.sitemap-lastmod-trustworthy` (that rule is in the crawlability category,
outside what the tool summarizes), so check the sitemap by hand.

**Without it.**

```bash
# Dates in sitemap
curl -sL https://example.com/sitemap.xml | grep -oE '<lastmod>[^<]+' | sort | uniq -c | sort -rn | head
# Dates in a page's JSON-LD
curl -sL https://example.com/post | grep -oE '"(dateModified|datePublished)"\s*:\s*"[^"]+"'
# Visible date
curl -sL https://example.com/post | grep -iE 'updated|published|<time'
```

A single value repeated across the whole sitemap, a value equal to today, or a value in the future
is a bug. For a given post, the visible date, the JSON-LD date and the sitemap lastmod should
describe the same moment (allowing for date-only versus full timestamp).

## Decide

**Was there a real change?** Use Google's own bar for sitemaps: "last significant modification".
Changing the primary text, adding or changing structured data, or updating links counts. A sidebar
tweak or footer change does not.

| Situation | Action |
|---|---|
| Content changed materially | Update `dateModified`, visible "Updated" date and sitemap `lastmod` together |
| Only template, footer, nav or styling changed | Leave all three alone |
| Typo or minor wording fix | Your call; it is not required to bump. Do not bump in bulk. |
| Page never had a date | Add `datePublished` with the real first-publish date. Add `dateModified` only if the page has genuinely been revised |
| CMS cannot tell real edits from template changes | Omit `lastmod` for those URLs. Google says leaving it out is fine |
| Build tool stamps every page at deploy | Stop. Derive from the content's real edit date |

If you cannot find the real date (no git history, no CMS record), do not invent one. Ask the user,
or leave the field out.

**Which pages deserve a real refresh?** That is a traffic question, not a date question. Hand off
to `seo-content-decay`: it calls `gsc_decay` and separates pages that lost rank (refresh helps) from
pages that lost clicks at steady rank (refreshing will not help). Then come back here to apply the
dates correctly after the content has actually been updated.

## Implement

1. **Source dates from the content, never the clock.** The right inputs are the CMS "modified" field,
   a frontmatter `updated:` field, or the last git commit that touched the content file (for example
   `git log -1 --format=%cI -- path/to/post.md`). Beware that a git commit date moves when someone
   reformats or renames a file; use a frontmatter field if you need control.
2. **One source feeds all three places.** Compute the date once per page, then render the visible
   date, the JSON-LD and the sitemap `lastmod` from the same value. That removes drift by design.
3. **Visible date.** Show "Published" and/or "Last updated" text near the title, in a `<time
   datetime="...">` element. Google asks for a user-visible date labelled like that, and for the
   structured and visible values to match.
4. **JSON-LD.** On Article, BlogPosting or WebPage, set `datePublished` and, if revised,
   `dateModified`, in ISO 8601. Date alone is required; time and timezone are optional but give
   precision. If you give a timezone, give the correct one. Never use a future date, and the date
   must be about the page's own publication or update, not the event it describes.
5. **Sitemap.** Emit `<lastmod>` only where you trust it. Use a supported date format (ISO 8601, as in sitemaps.org). Never emit a
   build timestamp.

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "How to ...",
  "datePublished": "2026-03-02",
  "dateModified": "2026-10-18"
}
```

Per-stack wiring (Next.js `sitemap.ts`, Astro, WordPress) is short enough that you can reuse the
principle: find where the sitemap is generated and replace `new Date()` with the content date.

## Verify

1. Re-run the sitemap grep. Dates should vary across URLs, none in the future, none all equal.
2. Pick three pages. Confirm the visible date, JSON-LD date and sitemap lastmod agree.
3. Re-run `analyze_website_aeo` and confirm `aeo.content-freshness` is no longer in `topFixes`.
   Check the sitemap rule by hand as described above.
4. Optional: paste a URL into Google's Rich Results Test or Search Console URL Inspection to confirm
   the structured data parses. Google does not guarantee a byline date will be shown, even when
   everything is correct.

## Pitfalls

- **Bulk-bumping dates to look fresh.** Google calls this out explicitly. It also undermines
  `lastmod`, which Google says it uses as a signal for scheduling crawls only when it proves reliable.
- **Build-time `lastmod`.** The textbook cause of `tech.sitemap-lastmod-trustworthy` failing.
  Frameworks default to this when no date is supplied.
- **Date only on one surface.** A JSON-LD date with no visible date, or the reverse, leaves one
  signal unchecked and one to drift.
- **Time zone shifts.** A date-only value near midnight can render as the previous or next day.
  Prefer a full timestamp with offset where precision matters.
- **Treating freshness as a ranking lever.** Google says adding or removing content to seem "fresh"
  will not help. Freshness signals report change; they do not create value.
- **Updating a stale page's date without checking its facts.** If the numbers are old, the date is
  a lie.

## Sources

- Google Search Central, Creating helpful, reliable, people-first content (dates and "fresh" warning signs): https://developers.google.com/search/docs/fundamentals/creating-helpful-content, verified 2026-11-13
- Google Search Central, Add a byline date (visible date, `datePublished` and `dateModified`, consistency, no future dates): https://developers.google.com/search/docs/appearance/publication-dates, verified 2026-11-13
- Google Search Central blog, Sitemaps `lastmod` and ping ("last significant modification", must match reality): https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping, verified 2026-11-13
- Google Search Central, Build and submit a sitemap: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap, verified 2026-11-13
- schema.org, dateModified: https://schema.org/dateModified (cited by the rule; not re-fetched, listed as the definition)
- Rule source: `packages/scoring/src/aeo-rules.ts` (`aeo.content-freshness`) and `technical-seo-rules.ts` (`tech.sitemap-lastmod-trustworthy`), read 2026-11-13
