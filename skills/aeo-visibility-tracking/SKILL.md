---
name: aeo-visibility-tracking
description: Measure whether AI answer engines actually cite a site, and whether that changes over time. Use when someone asks "are we showing up in AI answers", "is ChatGPT/Perplexity citing us", "did our AEO fixes work", "track our AI visibility", "which prompts should we track", or "how do we compare to competitors in AI search". Covers choosing a prompt set, a baseline, re-measure cadence, answer variance, competitor share, and tying movement to shipped fixes. Requires the aeo-toolkit aeo-visibility MCP server and the user's own Perplexity API key.
---

# Tracking AI visibility

Fixing a site for AI engines (crawler access, rendering, content shape) is the input.
Visibility tracking is the only way to see the output: **does an answer engine cite this
site for the questions its customers ask, and is that moving?** Done carelessly it produces
confident-looking numbers from a handful of noisy samples. Done well it gives a baseline, a
trend, and an honest "we can't tell yet".

## When this matters / when it doesn't

- Worth doing once the site is crawlable and indexable. Measuring a site that blocks AI
  crawlers just confirms the block; fix that first (see `aeo-ai-crawler-access`).
- Not worth it for a site with no stable prompts to track (a brand-new site, or one with no
  defined customers or topics). Define the audience first.
- Not a substitute for traffic data. Citation is not a click. Pair with `aeo-ai-referral-analytics`.

## What the tools actually measure

Read this before quoting any number. Per the tool definitions:

- `check_ai_visibility`, `get_visibility_report`, `compare_competitor_visibility` and the
  live-test step of `discover_ranking_prompts` all query **one engine: Perplexity Sonar**,
  using the user's own key (passed per call, never stored). They do **not** query ChatGPT,
  Claude, Gemini, Copilot or Google AI Overviews. A result is "cited by Perplexity", not
  "cited by AI".
- "Cited" means a URL on the **same host** appears in Sonar's returned citation list. Any page
  on the host counts, so a homepage citation and a deep-link citation both read as cited.
  `citationRank` is the position in the citation list, not prominence in the answer text.
- One call is one sample. There is no repeat-sampling built in.

## Steps

1. **Confirm the key and scope.** Ask for the Perplexity key and the exact URL (host) to
   track. Ask which competitors matter. Do not invent either.
2. **Build the prompt set.** Start from the customer, not the tool.
   - Ask the user for real questions: sales calls, support tickets, search queries
     (`gsc_top_queries` if `aeo-search` is connected, filtered to question-shaped queries).
   - Add candidates with `discover_ranking_prompts` (`url`, `topic`, `testCount`: 0 to 10,
     default 3). These are model-generated guesses at what people ask. Treat them as
     suggestions to review, not ground truth. Use `testCount: 0` to just get the list.
   - Mix intents deliberately: problem/how-to, comparison ("X vs Y"), category ("best X for
     Y"), and a few **branded** prompts. Report branded and unbranded rates **separately**.
     Branded prompts are cited almost by construction and will inflate a blended rate.
   - A set of 15 to 30 prompts is a reasonable starting size. Say so as a judgement, not a rule.
     Fewer than ~10 makes one flipped prompt a large swing in the rate.
   - Write the final list down with the date. **Freeze it.** Changing prompts between runs
     breaks comparison; add new prompts as a new set, don't edit the old one.
3. **Take the baseline.** Run the frozen set with `get_visibility_report` (`url`, `prompts`,
   `perplexityApiKey`). It also runs an AEO crawl (up to 10 pages), which is useful context but
   slower; if only citation data is wanted, loop `check_ai_visibility` instead. Record, per prompt:
   cited yes/no, `citationRank`, and which other domains were cited.
4. **Repeat the baseline once or twice** the same week before any fixes. The gap between
   those runs is your noise floor. If the same prompt flips cited/not-cited between identical
   runs, that prompt is unstable and single results on it mean little.
5. **Competitor share.** For prompts that matter, call `compare_competitor_visibility`
   (`prompt`, `urls`: two or more, include the user's own). It makes one Sonar call and
   matches all URLs against that one answer, so the comparison is internally consistent.
   Compare **share of prompts where each domain is cited** across the set, not a single prompt.
6. **Re-measure on a cadence** matched to how fast things change. Weekly or fortnightly is
   typical; daily adds cost and noise, not information. Always the same frozen set, same engine.
7. **Tie movement to shipped changes.** Keep a dated log of fixes (e.g. "unblocked
   OAI-SearchBot", "added FAQ schema to /pricing"). Compare the window before and after
   against the noise floor from step 4.

## How to read the result

- **Signal:** a citation rate that moves by more than the run-to-run noise, in the same
  direction across several consecutive re-measures, concentrated on the prompts the fix was
  aimed at.
- **Noise:** one prompt flipping; a rate that wobbles within the baseline spread; a change
  that appears on prompts unrelated to any fix.
- Report as counts with the denominator ("cited in 9 of 24 prompts, was 6 of 24"), not just
  a percentage. With small sets a percentage implies precision that isn't there.
- If a re-measure differs from baseline by less than the baseline-to-baseline gap, say
  "no detectable change yet", not "it worked" or "it failed".

## What it cannot tell you

- How ChatGPT, Claude, Gemini, Copilot or Google AI Overviews behave. Perplexity is one engine
  with its own retrieval; it is a proxy, not the market.
- Whether an answer *recommends* the site. A citation is a source link, not an endorsement.
- Real user prompts. The set is a model of what people ask.
- Causality. A rise after a fix is consistent with the fix, and also with a model update, a
  competitor losing a page, or chance.
- Personalisation, location and conversation history, none of which an API call reproduces.

## Pitfalls

- Quoting "AI visibility" when only Perplexity was queried.
- Blending branded and unbranded prompts into one headline number.
- Editing the prompt set between runs.
- Judging a fix from a single before/after pair.
- Letting `discover_ranking_prompts` output stand in for real customer questions.
- Putting the API key in a file or commit. It is a per-call argument; don't persist it.

## Sources

Tool behaviour from the aeo-visibility MCP tool definitions and AEO Toolkit `docs/VISIBILITY-TRACKING.md`
(verified 2026-11-13). Perplexity Sonar is the engine the tools call as of that date; recheck
if the server changes.
