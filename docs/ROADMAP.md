---
title: Roadmap
description: >-
  What the toolkit is building next, grouped by theme, with links to the GitHub issues where
  each item is discussed and claimed.
---

The original 9-tool build plan is **complete**. See
[ADR-0003](adr/0003-single-vercel-deployment.md) for how it was consolidated into one
deployment. This page is the forward-looking roadmap for what is open source in this repo.

**GitHub issues are the source of truth.** An item here is a theme; the issue is where the
design gets discussed and where you claim the work. If an item has no issue yet, open one
before starting. Ordering within a section is rough priority, not commitment.

## Scoring engine

- **Opportunity scoring** — rank findings by expected impact rather than severity
  ([#30](https://github.com/Advance-Labs/aeo-toolkit/issues/30)).
- The rule set is never finished — see *Adding a scoring rule* in
  [CONTRIBUTING](https://github.com/Advance-Labs/aeo-toolkit/blob/main/CONTRIBUTING.md) for
  the recipe; a new rule moves the pinned counts in `rules.test.ts` and the published copy
  that quotes them.

## Chrome extension and packages

- Keep the extension's 40 checks and the npm packages' behaviour in step with the scoring engine
  (the extension runs the rule set from the Chrome Web Store build, not the latest scoring release).
- Package READMEs and the [package reference](reference/packages.md) stay accurate as versions move.

## Hosted tools

The hosted tools at [advancelabs.dev/tools](https://advancelabs.dev/tools) and the three MCP
servers are a closed-source service, so their roadmap is not tracked here. Use the
[free tools](https://advancelabs.dev/tools) and the
[AI visibility service](https://advancelabs.dev/services/ai-visibility) page for what is live.

## Out of scope here

**AI-visibility tracking over time** (are the engines actually citing you, week over week)
deliberately lives outside this repo. See
[visibility tracking](VISIBILITY-TRACKING.md) for why.
