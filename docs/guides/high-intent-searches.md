---
title: High-intent searches you already rank for
description: >-
  One Search Console regex that finds comparison, pricing, review and "best" searches with high impressions and low clicks, and how to fix the page that ranks for them.
---

Some searchers are still learning ("what is X"). Others are about to choose ("X vs Y", "X
pricing", "X reviews", "best X"). Search Console does not separate the two, but one regex
does. The useful rows are the ones where a page **already ranks** and still gets almost no
clicks. Usually the page in the results does not show what the searcher asked for.

## The filter

In Search Console, open **Performance**, then **Search results**, then **Add filter**,
**Query**, **Custom (regex)**. Paste this without quotes:

```
\b(vs|versus|alternative|alternatives|competitor|competitors|compare|comparison|pricing|price|prices|cost|costs|review|reviews|best)\b
```

Set the date range to the last 3 months. Turn on the **Pages** tab as well as **Queries**,
because the fix goes on the page. Sort by impressions.

## Which rows to act on

Act on a row when all three are true:

1. **Average position is about 15 or better.** On page 1 and the top of page 2, the snippet
   decides the click. Past that, the problem is ranking, and a snippet change does not fix
   it.
2. **There are enough impressions to judge**, roughly 20 or more in 3 months.
3. **CTR is well below what that position usually gets.** As a rough guide, positions 8 to 10
   get 1 to 3% and positions 3 to 5 get several percent.

Then group the rows by page. Five high-intent queries on one page need one fix.

## What to add, by query word

| Query contains | Add near the top of the page |
|---|---|
| pricing, price, cost | A real price or range, what it includes, and "price" or "cost" in the title |
| review, reviews | Real reviews and a rating that links to where it can be checked |
| vs, compare, comparison | A side-by-side table, including where the other option wins |
| alternative, competitor | Who this is for, who it is not for, and the named alternatives |
| best | How to choose, and why this option fits. Put "best" in the title only if the page actually helps someone choose |

"Near the top" means the first screen. A section at the bottom of a long page does not change
what the searcher sees when they decide to click.

Three rules apply to every fix. Never invent reviews, ratings or prices. Do not add
`AggregateRating` markup for a business's reviews of itself, because Google treats that as
self-serving and against its rules. Take claims about a competitor from that competitor's
own public pages.

## Running it with the MCP server

The search MCP server's `gsc_search_analytics` tool returns the rows for
`dimensions: ["query","page"]`. Filter the returned rows with the regex above. The
[`seo-high-intent-ctr` skill](../../skills/seo-high-intent-ctr/SKILL.md) does the whole
process for an agent: it pulls the rows, applies the position and impression gates, and
writes the per-page recommendation with the honesty rules built in.

## Measuring the change

Use the same filter and the same pages, and compare CTR 28 days after the change ships. Check
the average position over the same window too. If the ranking moved at the same time, the CTR
change cannot be credited to the page edit alone.

## What the data cannot show

- Search Console hides rare queries for privacy, so the real high-intent volume is larger
  than the filter shows.
- The regex matches words, not intent. "best practices" and "vs code" match but are not
  buyer searches, so read each row before you count it.
- Average position mixes countries and devices. Break a row down before you decide it is a
  CTR problem.
