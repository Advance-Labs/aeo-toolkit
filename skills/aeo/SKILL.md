---
name: aeo
description: Entry point for making a website show up and get cited in AI answers (ChatGPT, Claude, Perplexity, Gemini, Google AI Overviews, Copilot). Use when someone asks to "do AEO" on a site, improve AI search visibility, get recommended by ChatGPT, audit a site for answer engines, or fix a list of AEO audit findings, and it is not yet clear which specific fix applies. Runs or reads an audit, groups the failures, orders them by impact, and hands each group to the skill that owns it. Uses the aeo-visibility MCP server if connected; works without it.
---

# AEO: audit, triage, hand off

This skill does not fix anything itself. It finds out what is wrong, decides what to do first, and
routes each problem to the skill that knows how to fix it in the user's stack. Every rule in the
AEO Toolkit audit has exactly one owning skill, so a failing rule ID always maps to one next step.

## When this matters / when it doesn't

Use it when the request is broad ("make us show up in ChatGPT") or when a user pastes an audit
report. Skip it when the request already names one concrete thing, like "add Organization schema"
or "why is GPTBot blocked". Go straight to that skill.

An audit score is a list of known causes of being skipped or misread by answer engines. It is
**not** a measurement of whether anyone cites you. Never tell a user their visibility went up
because a score did. Measure that separately (`aeo-visibility-tracking`).

## 1. Get the findings

**With the MCP server:** call `analyze_website_aeo` with the site's URL. It crawls up to 10 pages
and returns:

- `summary.topFixes`: the **top 8 at most** failed findings, sorted by severity and then weight. It
  only covers the AEO-relevant categories (AEO, structured data, content, metadata). Each fix has
  an `id` such as `aeo.ai-bots-allowed`, but no per-page URLs.
- `aiBotsAllowed`: the per-bot robots.txt verdicts.
- `filePresence`: robots.txt, sitemap and llms.txt.
- `summary.overall`, `summary.grade`, `summary.criticalCount`.

**That is a shortlist, not the full audit.** It never surfaces:
- the `eeat.*` rules
- `tech.open-graph-complete`, `tech.twitter-card`, `tech.viewport-mobile`, `tech.unique-titles`
- `tech.sitemap-lastmod-trustworthy`

An empty `topFixes` does not mean everything passes. For any skill whose rules the shortlist
can't show, run that skill's own **Detect** step:
- `aeo-eeat-trust-signals`
- `aeo-page-metadata`
- `aeo-content-freshness`

**Full rule list, without the MCP server:**
- The AEO Toolkit Chrome extension runs every rule on the open tab. Crawl-wide rules are skipped
  in single-page mode.
- The audit tool at advancelabs.dev/tools/audit runs the hosted audit.
- `@advance-labs/scoring` is a library with no CLI. Use it only if you are already writing code
  that builds a `ScoringContext`.
- If none of these is possible, work from the user's report. Rule IDs are the same everywhere.

If you are working inside the site's codebase rather than on a live URL, audit the deployed
preview or production URL. The rules read served HTML, not source.

## 2. Map each failed rule to its skill

Look up every failed `id` in [`references/rules.md`](references/rules.md). It is generated from
`skills/rule-map.json`, and CI keeps it complete. Group the findings by owning skill. Several
failures usually collapse into two or three skills.

## 3. Order the work

Fix in this order. Each layer is wasted effort if the layer above it is broken.

1. **Access.** Can answer engines fetch the content at all?
   - `aeo-ai-crawler-access`
   - `aeo-server-rendering`
   - `aeo-indexability`

   A site that blocks retrieval bots or renders its text in JavaScript gains nothing from
   schema or rewrites until this layer is fixed.
2. **Identity.** Do engines know who the site is?
   - `aeo-organization-entity`
   - `aeo-article-author-schema`
   - `aeo-structured-data-validation`
3. **Extractability.** Can an answer be lifted out of the page?
   - `aeo-answer-first-content`
   - `aeo-faq-qa-schema`
   - `aeo-site-structure`
4. **Hygiene and trust:**
   - `aeo-page-metadata`
   - `aeo-content-freshness`
   - `aeo-eeat-trust-signals`
   - `aeo-llms-txt`
5. **Off-site.** `aeo-citation-earning`, once the site is worth citing.

Within a layer, take critical-severity findings first, then the ones that affect the most pages.

Two skills aren't in the audit at all:
- **E-commerce:** add `aeo-product-schema`.
- **Businesses that serve a place:** add `aeo-local-business-schema`.

Neither has an audit rule yet. Ask whether either applies.

## 4. Baseline before changing anything

Before the first fix ships, record where the site stands, so later claims are evidence and not
hope:

- `aeo-visibility-tracking`: a prompt set and a first visibility reading. The MCP visibility tools
  query Perplexity Sonar only, so that reading is Perplexity citations, not "AI" in general.
- `aeo-ai-referral-analytics`: current AI-referral sessions, if GA4 is connected.

## 5. Hand off and verify

For each group, follow the owning skill. Each one ends with its own verification step. When all
groups are done, re-run `analyze_website_aeo` (or the engine) and confirm two things: the targeted
rules now pass, and **nothing else regressed**. Report what changed in the user's own terms ("AI
crawlers can now read the pricing page"), not just the score delta.

## Pitfalls

- **Fixing the score instead of the site.** For example, adding FAQ schema to a page with no
  visible FAQ to flip a rule. Every owning skill marks the cases where a failing rule is fine to
  leave. Respect them, and tell the user which findings you chose not to fix and why.
- **Auditing one page and generalizing.** Single-page mode skips the crawl-wide rules (sitemap
  coverage, unique titles, internal linking). Say so when that is all you have.
- **Promising outcomes.** No fix guarantees citations. Say "removes a known blocker", not "will get
  you into ChatGPT".
