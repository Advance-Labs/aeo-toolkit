---
name: seo-high-intent-ctr
description: Find a site's highest-intent Google searches (comparison, alternative, pricing, cost, review and "best" queries) that already rank but get few clicks, and work out what to add to the ranking page so it earns the click. Use when someone asks for buyer-intent or bottom-of-funnel queries, "money keywords" hiding in Search Console, high impressions with low clicks on commercial terms, or why a page ranks for "best X" or "X pricing" but nobody clicks. Requires the aeo-toolkit ga-gsc MCP server.
---

# High-intent queries that rank but do not get the click

People who search with words like *vs*, *alternative*, *pricing*, *cost*, *review* or
*best* are close to buying. When a site already ranks for those searches and still gets
almost no clicks, the usual cause is that the page in the results does not show what the
searcher typed: no price, no comparison, no reviews. That is often the cheapest traffic
gain on the site, because the ranking is already there.

Your job is to find these rows, keep only the ones a page change can fix, and say exactly
what that page is missing. Do not turn every match into a "rewrite the page" task.

## The filter

```
\b(vs|versus|alternative|alternatives|competitor|competitors|compare|comparison|pricing|price|prices|cost|costs|review|reviews|best)\b
```

In the Search Console UI it goes under Performance, Search results, then Add filter, Query,
Custom (regex). Paste it **without** surrounding quotes. Search Console uses RE2, which
supports `\b`. Add words for the site's market when they mean the same thing, such as
`cheap|cheapest|affordable|quote|rates|top` for local services.

## Finding it

1. Call `list_gsc_sites` and confirm the property.
2. Call `gsc_search_analytics` with `dimensions: ["query","page"]`, a 90-day range ending
   about two days ago (the newest days are incomplete), and a high `rowLimit`. You need the
   page dimension because the fix happens on the page, not on the query.
3. Apply the regex to the query string, case-insensitive. The tool returns all rows, so
   filter them yourself. On a large property the result can be too large to read inline.
   Write it to a file and filter it with `jq` or a short script.
4. Also total all impressions, so you can report what share of the site's search
   visibility is high-intent. A low share is a finding in itself.

`gsc_ctr_gaps` returns high-impression, low-CTR queries with no intent filter. Use it to
cross-check, but it cannot replace step 3.

## Keeping only the rows a page change can fix

Keep a row only if all of these hold:

- **Average position is about 15 or better.** On page 1 and the top of page 2, the snippet
  decides the click. Past that, almost nobody sees the result, so a low CTR is a ranking
  problem. Report those rows separately as "needs to rank first". Do not prescribe a snippet
  fix for them.
- **Impressions are high enough to judge.** Below about 20 impressions in 90 days, the CTR
  says very little. Report these rows grouped together, not one by one.
- **CTR is clearly under what that position usually gets.** Position 1 usually gets well
  above 20%, positions 3 to 5 get several percent, and positions 8 to 10 get 1 to 3%. These
  are rough industry ranges. Present a gap as "well below typical", not as a precise
  benchmark.

Then group the remaining rows by **page**. Several high-intent queries landing on one page
need one fix, not several.

## What each intent word asks for

Look at the live page first: its title, its meta description, and what shows in the first
screen. Then compare it with what the query asks for.

| Query contains | The searcher wants | Add near the top of the ranking page |
|---|---|---|
| `pricing`, `price`, `cost` | A number | A real starting price or range, what it includes, and the word "price" or "cost" in the title or description |
| `review`, `reviews` | Proof from other people | Real reviews and a rating that links to where it can be checked (Google, G2, Trustpilot) |
| `vs`, `versus`, `compare`, `comparison` | A side-by-side view | A comparison table on criteria the buyer cares about, including the cases where the other option wins |
| `alternative`, `alternatives`, `competitor` | Options | An honest "who this is for and who it is not for" section, plus the named alternatives |
| `best` | A shortlist and the criteria behind it | How to choose, and why this option fits. Put the word "best" in the title only if the page actually helps someone choose |

"Near the top" means the first screen. A section at the bottom of a long page does not
change what the searcher sees when they decide to click.

## Rules that stop the fix from doing harm

- **Never invent reviews, ratings, prices or competitor claims.** If the page has no real
  reviews, the recommendation is "collect reviews". It is never "add a reviews section"
  filled with placeholder text. Fake testimonials are a legal risk (consumer-protection
  law), not only an SEO risk.
- **Do not add `AggregateRating` markup for a business's reviews of itself.** Google's
  structured-data rules treat self-serving review markup on a `LocalBusiness` or
  `Organization` as a violation. A visible rating that links to the source is the honest
  version.
- **Comparison claims about a named competitor must come from that competitor's own public
  material.** Cite it, date it, and include the points where they win. A comparison that
  only says nice things about the publisher gets ignored by readers and by AI answer
  engines.
- **Prices must come from the site's own source of truth.** Do not type prices into new copy
  when the site already stores them somewhere else. Two pages that quote different numbers
  to the same buyer do more damage than a missing price.

## Limits of the data

- **Search Console hides rare queries** for privacy. Many low-volume high-intent searches
  never show up as rows, so the true high-intent share is larger than the filter shows.
- **Average position is an average.** A query at an average of 9 may sit at 3 in one country
  and 40 in another. Break it down by `country` or `device` before you call a row a CTR
  problem.
- **The filter matches words, not intent.** "best practices for X" matches `best` but is
  informational. "vs code" matches `vs`. Read each row before you count it.

## Reporting

For each page, give the queries, the numbers, the missing piece, and the fix:

> /pricing ranks 6.2 on average for "acme analytics pricing" (140 impressions, 1 click) and
> 8.9 for "acme vs northwind" (60 impressions, 0 clicks). The page shows prices only after
> two screens and has no comparison section. Fix: move the price table above the fold, put
> "Pricing" in the title, and add a short comparison with Northwind taken from Northwind's
> own pricing page.

After that, list the rows that need to rank first, and the share of total impressions that
is high-intent. End with how to measure the result: the same filter, the same pages, CTR 28
days after the change ships. Compare positions too, because a CTR change during a ranking
change cannot be credited to the snippet.
