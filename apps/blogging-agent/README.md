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

With no `PUBLISH_WEBHOOK_URL`, the agent runs a **dry run** (`NoopPublisher`): it does everything
except the live publish, computing canonical URLs deterministically. Set `PUBLISH_WEBHOOK_URL` to
enable the real `CmsPublisher`, which POSTs each rendered post to the webhook and (when
`DEPLOY_HOOK_URL` is set) pings a deploy hook.

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
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | no | — | Enable the durable Supabase post store; omit for the JSON-file store. |
| `POSTS_TABLE` | no | `posts` | Supabase posts table name. |
| `POST_STORE_PATH` | no | `./data/posts.json` | JSON post-store location (fallback). |
| `PUBLISH_WEBHOOK_URL` | no | — | Enable the live publisher; omit for dry run. |
| `PUBLISH_WEBHOOK_TOKEN` | no | — | Request-scoped bearer token for the publish webhook. |
| `DEPLOY_HOOK_URL` | no | — | Deploy hook pinged (empty POST) after a publish. |
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
Jaccard dedup engine, the `InMemoryPostStore` and durable `JsonFilePostStore`, the real
`SupabasePostStore` (via `@aeo/storage`'s `createSupabaseClient`) with the `getPostStore` env-gated
factory, the `NoopPublisher` dry-run path **and** the real `CmsPublisher` (webhook POST + optional
deploy hook) with the `getPublisher` env-gated factory, env/config resolution with the
Groq-vs-reasoning cost split, and the GSC/GA4 + LLM typed seams. All wired against the real
`@aeo/llm`, `@aeo/google-api`, and `@aeo/storage` APIs. Fully unit-tested with all external I/O
mocked (Jaccard logic, every agent, the publisher with a mocked fetch, the Supabase store with a
fake client, the env-gated factories, and the end-to-end pipeline).

No live credentials are needed to build, typecheck, or test. With no `PUBLISH_WEBHOOK_URL` the agent
runs a dry run; with no `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` it uses the JSON-file store.
