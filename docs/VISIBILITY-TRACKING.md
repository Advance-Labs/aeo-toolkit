---
title: Visibility tracking
description: >-
  The off-page companion to the audit: proving over time that AI engines actually cite a site, not just that it is built to be cited.
---

The AEO Toolkit answers **"is this site built to be cited?"** It crawls a site, scores it
against the 44 technical SEO and AEO checks (plus a separate 14-signal E-E-A-T scan), and renders a
scorecard. That is a **point-in-time, on-page diagnostic**.

It does **not** answer the question a site owner cares about most: **"is it working? Are the AI
engines now citing me for the questions my customers ask, and is that improving?"** That is an
**off-page, over-time outcome**, and it lives in a separate companion system: the
**AEO Visibility Tracker**.

This page explains what the tracker is, why it lives outside this repo, and how the two systems
fit together.

> **Where the code lives:** the tracker is closed-source hosted tooling and is not in this repo.
> This repo (the toolkit) stays a clean, public, Apache-2.0 audit suite.

---

## Two halves of one job

| | **AEO Toolkit (this repo)** | **Visibility Tracker (hosted service)** |
|---|---|---|
| Question | Is the site *built* to be cited? | Is the site *actually* being cited, over time? |
| Layer | On-page (the site itself) | Off-page (the AI engines' answers) |
| Method | Crawl → 44-check score → PDF | Ask AI engines the questions customers ask → record cited / rank |
| Cadence | Point-in-time (per audit) | Recurring (weekly time series) |
| Output | Scorecard + prioritized fixes | `cited 0% → 67%`, `avg rank 4.0 → 1.5` deltas |
| Role | Baseline + the fix list | Proof the fixes moved the needle |

The **toolkit audit** sets the baseline score and the list of fixes; the **tracker** shows, week
over week, whether that work changed what the AI engines actually say.

---

## How the tracker works

For each tracked site, question and engine, it asks an AI search engine the questions that site's
customers type ("best HVAC in London Ontario"), then analyzes the answer:

- **cited**: did the business appear in the answer text or in the engine's cited sources?
- **rank**: its 1-based position among named competitors in the prose (`null` if only matched
  via a source URL, because a footnote citation is not a recommendation ranking).
- **competitors_cited**: which tracked competitors won the slot instead.
- **sources / excerpt**: evidence, meaning the citation URLs and a snippet around the mention.

Each check is one timestamped row. Diffing the history yields the before and after.

**Engines:** Perplexity, OpenAI (with web search) and Gemini, called through one gateway so
results stay comparable across engines. Each row records which engine answered.

**Cadence:** a weekly scheduled run, plus ad-hoc runs for backfills and reports.

---

## The join point: `audit_score`

The tracker's schema reserves an `audit_score` column to bridge the two systems. A planned
enhancement runs this toolkit's `@advance-labs/scoring` on each tracked site per run and logs the
**on-page score** next to the **off-page citation result**, so one table tells the whole story:

> "The AEO score went from F (38) to A (91); over the same 6 weeks the ChatGPT citation rate went
> 0% → 67% and the average rank 4.0 → 1.5."

The audit explains *why*; the tracker proves *that*.

---

## See also

- This repo: [Architecture](ARCHITECTURE.md) and `packages/scoring`, the audit engine the
  baseline is built on.
- The hosted service: [advancelabs.dev/services/ai-visibility](https://advancelabs.dev/services/ai-visibility).
