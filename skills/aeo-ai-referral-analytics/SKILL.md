---
name: aeo-ai-referral-analytics
description: Measure traffic that AI assistants send to a site, using Google Analytics 4. Use when someone asks "how much traffic comes from ChatGPT/Perplexity/Claude", "are AI answers sending us visitors", "set up an AI traffic channel in GA4", "which pages do AI assistants send people to", or "is our AEO work driving visits". Covers the GA4 query, a reusable referrer regex, landing pages, and why the number is always an undercount. Requires the aeo-toolkit aeo-search MCP server with Google OAuth.
---

# AI referral analytics (GA4)

AI assistants send some visitors with a referrer or a `utm_source` tag, and GA4 records
them. That subset is measurable. It is **a floor, not the total**: most AI influence never
produces a tagged click. Report it as "at least N sessions", never as the size of AI impact.

## When this matters / when it doesn't

- Matters: showing whether AEO work produces visits, and which pages earn them.
- Weak evidence on its own: small sites will have tens of sessions, where week-to-week
  moves are noise. Say so instead of charting a trend.
- Not a visibility metric. Whether the site is *cited* is `aeo-visibility-tracking`.

## Steps

1. `list_ga4_properties`, confirm the property with the user. Don't guess the ID.
2. **Pull sources, then filter yourself.** `ga4_run_report` takes `propertyId`, `dateRanges`,
   `dimensions`, `metrics` and `limit` only: **there is no filter argument.** So request
   a broad grouping and filter the returned rows:
   - dimensions: `sessionSource`, `sessionMedium` (add `landingPage` for step 4)
   - metrics: `sessions`, `engagedSessions`, `keyEvents` (use only metric names GA4 accepts for
     the property; if a call errors, drop the metric rather than guessing)
   - `limit`: high (e.g. 10000) so the long tail of sources is not truncated.
   Use a range of at least 28 days. Keep the same length when comparing periods.
3. **Match AI sources.** Apply the regex in `references/ga4-setup.md` to `sessionSource`.
   Also list sources that *almost* match and any unfamiliar source containing `ai`, `gpt`,
   `chat` or `claude`, and show them to the user: new assistants appear faster than any
   list. Do not silently drop or add rows.
4. **Landing pages.** Re-run with `landingPage` and `sessionSource`, filter to the AI
   sources, rank pages by sessions. These are the pages assistants actually send people to.
   Compare against pages you expected; mismatches are the useful finding.
5. **Quality.** Compare engaged sessions per session and key events for AI sessions against
   organic search. With under ~30 AI sessions, say the comparison is too thin to read.
6. **Trend.** Re-run `date` + `sessionSource` weekly if the volume supports it.

## How the traffic is tagged

- OpenAI's publisher FAQ states ChatGPT adds `utm_source=chatgpt.com` to links it sends, and
  that this tracking depends on the site allowing OAI-SearchBot. Verified via an excerpt
  of that FAQ; OpenAI's help pages block automated fetching, so re-read it before quoting.
- For other assistants (Perplexity, Claude, Gemini, Copilot) we did **not** verify referrer
  hostnames or tagging against primary sources. The regex lists likely hostnames; step 3's
  "unfamiliar source" review is how you confirm what really appears in this property.
- GA4 dimension names `sessionSource`, `sessionMedium`, `sessionDefaultChannelGroup`,
  `landingPage` and `pageReferrer` exist in the Data API schema (verified 2026-11-13).
  `pageReferrer` is the full previous URL, per page, not per session.

## How to read the result

- **Signal:** AI sessions that are consistently present across weeks, concentrated on
  identifiable pages, with engagement similar to other referral traffic.
- **Noise:** week-to-week swings on a few dozen sessions; a one-day spike (often a single
  mention or a crawler/bot).
- Always state the denominator: AI sessions as a share of all sessions, with both counts.

## What it cannot tell you (undercounting, be explicit)

- **No-click influence.** A user reads an answer that names the brand, then searches it
  or types the URL later. That arrives as organic or **direct**.
- **Stripped or missing referrers.** Copied links, apps, in-app browsers and some privacy
  settings drop the referrer, so visits land in "direct". One secondary source says this
  happens for in-app browsers and copied links; not confirmed by OpenAI.
- **Assistants that don't tag.** Without a referrer or UTM, nothing in GA4 identifies them.
- **Bot and crawler traffic** is not a visitor; GA4 filters known bots, not all of them, so crawler
  activity needs server logs, not GA4.
- Causality: a visit does not show that an AEO change caused it.

Do not "correct" for undercounting with a multiplier. There is no verified one.

## Pitfalls

- Presenting the AI-referral total as total AI impact.
- Reading `direct` growth as AI traffic with no other evidence.
- A regex that is stale: review unmatched sources each time.
- Comparing periods of different length or weekday mix.
- Changing the channel definition mid-trend without noting the date.

## Sources

- GA4 Data API schema, https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema (dimension names), verified 2026-11-13.
- OpenAI Publishers and Developers FAQ, help.openai.com article 12627856 (`utm_source=chatgpt.com`), verified 2026-11-13 via search excerpt only.
- OpenAI crawler docs, https://platform.openai.com/docs/bots, verified 2026-11-13.
- Tool behaviour from the aeo-search `ga4_run_report` definition, verified 2026-11-13.
- Hostnames other than chatgpt.com: NOT verified.
