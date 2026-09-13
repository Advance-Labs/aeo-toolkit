> [!WARNING]
> **Archived and historical — this does not describe the current repository.**
> Written before the consolidation in [ADR-0003](../../adr/0003-single-vercel-deployment.md); the `apps/` layout and package list below no
> longer exist. Kept for design history only. See [the archive index](../README.md) for what replaced it.

---

# Tool 9 — Autonomous Blogging Agent (`apps/blogging-agent`)

**Type:** Multi-agent Node/TS pipeline · **Deploy:** GitHub Actions (scheduled) + manual run
**Depends on:** `@advance-labs/google-api`, `@advance-labs/llm`, `@advance-labs/types`

## What it does
A pipeline of specialized agents that research, write, edit, schedule, and self-correct blog content,
publishing to a static site / CMS. Cost-split: cheap bulk drafting (Groq) + strategic reasoning (a
stronger model), all via `@advance-labs/llm` (BYOK).

## Agents (`src/agents/*`)
1. **Strategy** — one-time competitor / content-pillar research → `strategy.json`.
2. **Research** — GSC query gaps (`@advance-labs/google-api`) + competitor sitemaps + SERP dedup → topic briefs.
3. **Writer** — full markdown articles with internal links + web research (Groq via `@advance-labs/llm`).
4. **Editor** — SEO/clarity review pass.
5. **Smart Scheduler** — queue / ramp / opportunity scoring.
6. **Performance Monitor** — daily GSC + GA4 health scores.
7. **Self-Correction** — rewrite / retitle / requeue underperformers.
8. **Post Memory + Dedup** — Jaccard fingerprint index (SQLite locally; pluggable store interface for Supabase).

## Orchestration
- `src/run.ts` orchestrator wires the agents; `src/store/` defines a `PostStore` interface
  (SQLite default, `// STUB:` Supabase adapter).
- A GitHub Actions workflow doc under the app describes the schedule + required secrets
  (`GROQ_API_KEY`, `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`, `GOOGLE_*`). **Never** inline secrets in `run:`.

## Notes
- Keep each agent a pure-ish function taking typed input → typed output for testability; mock `@advance-labs/llm`
  and `@advance-labs/google-api` in tests. Live publishing is the only true side effect — isolate it behind a `Publisher` interface.
