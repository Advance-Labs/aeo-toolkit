---
title: Roadmap
description: >-
  What the toolkit is building next, grouped by theme, with links to the GitHub issues where
  each item is discussed and claimed.
---

The original 9-tool build plan is **complete** — see the
[archived build plan](archive/BUILD-PLAN.md) for what shipped and
[ADR-0003](adr/0003-single-vercel-deployment.md) for how it was consolidated into one
deployment. This page is the forward-looking roadmap.

**GitHub issues are the source of truth.** An item here is a theme; the issue is where the
design gets discussed and where you claim the work. If an item has no issue yet, open one
before starting. Ordering within a section is rough priority, not commitment.

## Dogfooding the product on our own site

From the [SEO + AEO plan](SEO-AEO-PLAN.md) — the toolkit teaches these patterns, so its own
site has to ship them:

- **Glossary pages** (`/glossary/*`) — definition pages for AEO/GEO terms (AEO, GEO, llms.txt,
  E-E-A-T, answer engine, citation), interlinked into a topic cluster. Definitional queries are
  where AI assistants cite most readily.
- **Comparison pages** (`/compare/*`) — starting with `/compare/aeo-vs-seo`; the
  comparison/listicle queries answer engines synthesize from.
- **Cornerstone guide** (`/guide/answer-engine-optimization`) — the what/why/how pillar page,
  linking to every tool.
- **Self-audit in CI** — run our own auditor against advancelabs.dev in a scheduled workflow
  and fail below a threshold, so the site can never quietly regress on the rules it sells.
- **Vercel Speed Insights** — close the Core Web Vitals measurement gap in
  [the plan's §7](SEO-AEO-PLAN.md).

## Scoring engine

- **Starter rules** — [#10 `tech.charset-declared`](https://github.com/Advance-Labs/aeo-toolkit/issues/10),
  [#11 `aeo.content-freshness`](https://github.com/Advance-Labs/aeo-toolkit/issues/11),
  [#12 `tech.hreflang-valid`](https://github.com/Advance-Labs/aeo-toolkit/issues/12).
- **Opportunity scoring** — rank findings by expected impact rather than severity
  ([#30](https://github.com/Advance-Labs/aeo-toolkit/issues/30)).
- The rule set is never finished — see *Adding a scoring rule* in
  [CONTRIBUTING](https://github.com/Advance-Labs/aeo-toolkit/blob/main/CONTRIBUTING.md) for
  the recipe; a new rule moves the pinned counts in `rules.test.ts` and the published copy
  that quotes them.

## Search-data tools (GA4 + GSC)

- **Topical hub mapping** — cluster GSC queries into topic hubs
  ([#31](https://github.com/Advance-Labs/aeo-toolkit/issues/31)).
- **GSC history retention** — persist snapshots to break the 16-month API ceiling
  ([#29](https://github.com/Advance-Labs/aeo-toolkit/issues/29)).

## Backlinks

- **Optional paid data provider** — DataForSEO behind the existing `backlinks` seam, BYOK as
  always ([#20](https://github.com/Advance-Labs/aeo-toolkit/issues/20)).

## Infrastructure & code health

- **Postgres token store** — durable tokens without requiring Supabase
  ([#23](https://github.com/Advance-Labs/aeo-toolkit/issues/23)).
- **Split `AuditExperience.tsx`** — 1061 lines into focused components
  ([#14](https://github.com/Advance-Labs/aeo-toolkit/issues/14)).
- **Test coverage for `@advance-labs/llm` json helpers**
  ([#13](https://github.com/Advance-Labs/aeo-toolkit/issues/13)).

## Managed tier

Tracked as `TODO(lead)` markers in the code rather than issues, since they depend on
production configuration: live delivery counts and a citation snapshot in the account panel,
a public route for the guarantee terms, and a citation-coverage snapshot at onboarding.
The [activation runbook](ACTIVATION.md) covers turning the tier on.

## Out of scope here

**AI-visibility tracking over time** (are the engines actually citing you, week over week)
deliberately lives outside this repo — see
[visibility tracking](VISIBILITY-TRACKING.md) for why and where.
