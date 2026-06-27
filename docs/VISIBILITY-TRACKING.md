# Visibility Tracking — the off-page companion to the audit

The AEO Toolkit answers **"is this site built to be cited?"** — it crawls a site, scores it
against the 51 AEO / E-E-A-T / technical rules, and renders a scorecard. That is a
**point-in-time, on-page diagnostic**.

It does **not** answer the question a retainer client actually pays for: **"is it working —
are the AI engines now citing me for the queries my customers ask, and is that improving?"**
That is an **off-page, over-time outcome**, and it lives in a separate companion system: the
**AEO Visibility Tracker**.

This doc explains what the tracker is, why it lives outside this repo, and how the two
systems fit together — so anyone working in the toolkit understands the full retainer loop.

> **Where the code lives:** the tracker is implemented in the private
> [`Advance-Labs/advance-labs`](https://github.com/Advance-Labs/advance-labs) repo under
> `scripts/aeo-tracker/` (CLI + canonical, unit-tested logic) and
> `web/src/app/api/cron/aeo-tracker/` (the Vercel Cron runner). This repo (the toolkit)
> stays a clean, public, MIT audit suite; the tracker is operational/retainer tooling.

---

## The two halves of a retainer

| | **AEO Toolkit (this repo)** | **Visibility Tracker (advance-labs repo)** |
|---|---|---|
| Question | Is the site *built* to be cited? | Is the site *actually* being cited, over time? |
| Layer | On-page (the site itself) | Off-page (the AI engines' answers) |
| Method | Crawl → 51-rule score → PDF | Ask AI engines the money queries → record cited?/rank |
| Cadence | Point-in-time (per audit) | Recurring (weekly time-series) |
| Output | Scorecard + prioritized fixes | `cited 0% → 67%`, `avg rank 4.0 → 1.5` deltas |
| Role | Baseline + the fix list | Proof the fixes moved the needle |

A retainer brackets the two: the **toolkit audit** sets the baseline score and the fix
backlog; the **tracker** proves, week over week, that the work changed what ChatGPT and
Perplexity actually say.

---

## How the tracker works

For each tracked client × query × engine, it asks an AI search engine the questions that
client's customers type ("best HVAC in London Ontario"), then analyzes the answer:

- **cited** — did the business appear in the answer text or in the engine's cited sources?
- **rank** — its 1-based position among named competitors in the prose (`null` if only
  matched via a source URL — a footnote citation isn't a recommendation ranking).
- **competitors_cited** — which tracked competitors won the slot instead.
- **sources / excerpt** — evidence: the citation URLs and a snippet around the mention.

Each check is one timestamped row in a Supabase `aeo_visibility_checks` table. Diffing the
history (`computeDelta`) yields the before/after a client pays to see.

**Engines:** Perplexity (online model, returns explicit citations) is the primary adapter;
OpenAI (Responses API + web search) is the optional second. ChatGPT (~60% of AI-search
share) and Perplexity are the consumer surfaces that matter; Google AI Overviews via SerpAPI
is the obvious next adapter.

**Runners:** a weekly **Vercel Cron** (production, persists to Supabase) and a
**zero-dependency CLI** (`node scripts/aeo-tracker/run.mjs`, for ad-hoc runs, backfills, and
`--delta` reports).

---

## The join point: `audit_score`

The tracker's schema reserves an `audit_score` column specifically to bridge the two
systems. A future enhancement runs this toolkit's `@aeo/scoring` (via its CLI or hosted
`ai-visibility` MCP) on each tracked client per run and logs the **on-page score** next to
the **off-page citation result**. That single table then tells the whole story in one place:

> "We raised your AEO score from F (38) to A (91); over the same 6 weeks your ChatGPT
> citation rate went 0% → 67% and your average rank 4.0 → 1.5."

That is the toolkit and the tracker working as one retainer instrument — the audit explains
*why*, the tracker proves *that*.

---

## See also

- This repo: `docs/ARCHITECTURE.md`, `docs/SEO-AEO-PLAN.md`, `packages/scoring`,
  `packages/pdf` — the audit/scorecard engine the retainer baseline is built on.
- advance-labs repo: `scripts/aeo-tracker/README.md` — the tracker's full technical docs
  (data model, setup, both runners, extending).
