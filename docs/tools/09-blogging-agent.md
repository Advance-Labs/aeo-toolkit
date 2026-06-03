# Tool 9 — Autonomous Blogging Agent (`apps/blogging-agent`)

**Type:** Multi-agent Node/TS pipeline · **Deploy:** GitHub Actions (scheduled) + manual run
**Depends on:** `@aeo/google-api`, `@aeo/llm`, `@aeo/types`

## What it does
A pipeline of specialized agents that research, write, edit, schedule, and self-correct blog content,
publishing to a static site / CMS. Cost-split: cheap bulk drafting (Groq) + strategic reasoning (a
stronger model), all via `@aeo/llm` (BYOK).

## Agents (`src/agents/*`)
1. **Strategy** — one-time competitor / content-pillar research → `strategy.json`.
2. **Research** — GSC query gaps (`@aeo/google-api`) + competitor sitemaps + SERP dedup → topic briefs.
3. **Writer** — full markdown articles with internal links + web research (Groq via `@aeo/llm`).
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
- Keep each agent a pure-ish function taking typed input → typed output for testability; mock `@aeo/llm`
  and `@aeo/google-api` in tests. Live publishing is the only true side effect — isolate it behind a `Publisher` interface.
