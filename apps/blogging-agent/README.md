# @aeo/blogging-agent

An autonomous, multi-agent blogging pipeline. Each run researches Search Console query gaps, drafts
articles, edits them, dedups against past content, schedules them, publishes what's due, and
self-corrects underperformers — using a deliberate cost-split: cheap bulk drafting on **Groq** and
strategic reasoning on a stronger model (**Anthropic** or **OpenAI**), all through the BYOK
`@aeo/llm` client. Google data (GSC + GA4) flows through `@aeo/google-api`. It runs as a plain Node
entrypoint, designed for a daily GitHub Actions schedule or a manual `node dist/run.js`.

## Pipeline

```
monitor ─▶ self-correct ─▶ research ─▶ write ─▶ edit ─▶ schedule ─▶ publish
 (GSC+GA4)   (reasoning)     (GSC gaps)  (Groq)  (lint+   (ramp/     (side
  health)                                         polish)  dedup)     effect)
```

Each agent is a pure-ish `input → output` function with its I/O (LLM, Google, persistence,
publishing) injected as a typed seam, so the whole pipeline is unit-testable with **no network and
no credentials**.

| Agent (`src/agents/*`) | Responsibility | Model / data |
|---|---|---|
| `strategy.ts` | One-time competitor / content-pillar research → `Strategy`. | reasoning model |
| `research.ts` | GSC query gaps → scored, deduped `TopicBrief`s. | `@aeo/google-api` GscClient |
| `writer.ts` | Brief → full markdown article + front-matter. | Groq (`@aeo/llm`) |
| `editor.ts` | Deterministic SEO lint + optional LLM polish. | reasoning model (optional) |
| `scheduler.ts` | Queue/ramp edited posts onto publish dates. | pure |
| `monitor.ts` | Daily per-post health from GSC + GA4. | `@aeo/google-api` |
| `self-correction.ts` | Rewrite / requeue / archive underperformers. | reasoning model |
| `dedup.ts` | Jaccard shingle fingerprints for near-duplicate detection. | pure |

## Run

```bash
pnpm --filter @aeo/blogging-agent build
node apps/blogging-agent/dist/run.js
```

With no `PUBLISH_TOKEN`/`PUBLISH_TARGET`, the agent runs a **dry run** (`NoopPublisher`): it does
everything except the live publish, computing canonical URLs deterministically. Provide publish
credentials to enable the (stubbed) `CmsPublisher`.

You can also drive the pipeline programmatically with injected dependencies:

```ts
import { runPipeline, InMemoryPostStore } from '@aeo/blogging-agent';
import { NoopPublisher } from '@aeo/blogging-agent';
// inject config, strategy, store, publisher, complete, gscQuery, ga4Report
```

## Environment variables

| Var | Required | Default | Purpose |
|---|---|---|---|
| `GROQ_API_KEY` | yes | — | Bulk drafting (Groq). BYOK, request-scoped. |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | one of | — | Reasoning model (Anthropic preferred). |
| `GOOGLE_ACCESS_TOKEN` | yes | — | Read-only OAuth token for GSC + GA4. |
| `GA4_PROPERTY_ID` | yes | — | Numeric GA4 property id. |
| `SITE_URL` | yes | — | Canonical site origin. |
| `GSC_SITE_URL` | no | `SITE_URL` | Search Console property URL. |
| `POST_STORE_PATH` | no | `./data/posts.json` | JSON post-store location. |
| `PUBLISH_TOKEN` / `PUBLISH_TARGET` | no | — | Enable the live publisher; omit for dry run. |
| `VERCEL_DEPLOY_HOOK_URL` | no | — | Deploy hook pinged after a publish. |
| `MAX_NEW_POSTS_PER_RUN` | no | `3` | New drafts attempted per run. |
| `UNDERPERFORMANCE_THRESHOLD` | no | `0.3` | Health score below which self-correction fires. |
| `DEDUP_THRESHOLD` | no | `0.8` | Jaccard similarity that marks a duplicate. |
| `GROQ_MODEL` / `ANTHROPIC_MODEL` / `OPENAI_MODEL` | no | sensible defaults | Override model ids. |
| `CONTENT_PILLARS` / `COMPETITORS` / `AUDIENCE` / `VOICE` | no | minimal defaults | Strategy seed. |

> BYOK keys are read from the environment at run time, live only in memory, and are never persisted
> or logged. The structured run summary printed at the end contains no secrets.

Scheduling and the canonical GitHub Actions workflow (with the full secrets list) are documented in
[`docs/github-actions.md`](./docs/github-actions.md).

## Public API

| Export | Kind | Description |
|---|---|---|
| `runPipeline(deps)` | function | Run one full pass over injected dependencies → `RunSummary`. |
| `main(env?)` | function | Build production wiring from env and run once. |
| `PipelineDeps`, `RunSummary` | types | Orchestrator contract. |
| `PostStore`, `InMemoryPostStore`, `JsonFilePostStore` | interface/classes | Persistence seam + default impls. |
| `Publisher`, `NoopPublisher`, `CmsPublisher` | interface/classes | Publish seam (the only side effect). |
| `runStrategy`, `runResearch`, `runWriter`, `runEditor`, `runScheduler`, `runMonitor`, `runSelfCorrection` | functions | The agents. |
| `fingerprint`, `jaccard`, `checkDuplicate` | functions | Dedup primitives. |

(See `src/index.ts` for the exact surface.)

## Status

**Implemented (real, runnable):** all eight agents, the orchestrator (`runPipeline`/`main`), the
Jaccard dedup engine, the `InMemoryPostStore` and durable `JsonFilePostStore`, the `NoopPublisher`
dry-run path, env/config resolution with the Groq-vs-reasoning cost split, and the GSC/GA4 + LLM
typed seams. All wired against the real `@aeo/llm` and `@aeo/google-api` APIs. Fully unit-tested
with `@aeo/*` and external I/O mocked (Jaccard logic, every agent, the store, and the end-to-end
pipeline).

**Stubbed (typed `// STUB:` seams):**
- `CmsPublisher` — the live Git/CMS publish + Vercel deploy hook (the only true side effect).
- `SupabasePostStore` — durable cross-run persistence (the in-memory and JSON stores are real).

No live credentials are needed to build, typecheck, or test.
