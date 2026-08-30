# @advance-labs/blogging

An autonomous, multi-agent blogging pipeline for the AEO Toolkit. It mines Search Console for query
gaps, drafts articles, edits and de-duplicates them, schedules and publishes on a cadence, monitors
live performance, and self-corrects underperformers — all in one idempotent pass.

Every stage upstream of publishing is pure data transformation; the single true side effect is the
`Publisher`. All external I/O (LLM completions, GSC/GA4 reads, persistence, publishing) is reached
only through injectable seams, so the whole pipeline runs in unit tests with **no network and no
credentials**.

## Pipeline stages (one run)

1. **monitor** — refresh GSC + GA4 health for published posts.
2. **self-correction** — rewrite / requeue / archive underperformers (reasoning model).
3. **research** — find GSC query gaps → fresh topic briefs (deduped against the store).
4. **write** — draft each brief (Groq, bulk).
5. **edit** — lint + polish each draft.
6. **schedule** — queue edited posts onto publish dates (one per day, ramped).
7. **publish** — push posts that are due today (the only side effect).

## Usage

### Env-driven (the deployment / cron path)

```ts
import { runBloggingPipeline } from '@advance-labs/blogging';

// Resolves every seam from process.env (BYOK keys, Google token, Supabase, publish webhook),
// runs one pass, and returns a log-safe summary that contains no secrets.
const summary = await runBloggingPipeline();
console.log(summary.published, 'posts published');
```

The env-driven wiring chooses adapters automatically:

- **PostStore** — `SupabasePostStore` when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set,
  otherwise the durable `JsonFilePostStore` at `POST_STORE_PATH` (default `./data/posts.json`).
- **Publisher** — `CmsPublisher` when `PUBLISH_WEBHOOK_URL` is set, otherwise `NoopPublisher`
  (dry run, no credentials needed).

### Dependency-injected (tests and custom hosts)

```ts
import { runPipeline, InMemoryPostStore, NoopPublisher } from '@advance-labs/blogging';

const summary = await runPipeline({
  config,
  strategy,
  store: new InMemoryPostStore(),
  publisher: new NoopPublisher('https://example.com'),
  complete: myMockComplete, // CompleteFn
  gscQuery: myMockGscQuery, // GscQueryFn
  ga4Report: myMockGa4Report, // Ga4ReportFn
  now: () => new Date('2026-06-03T00:00:00.000Z'),
});
```

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `GROQ_API_KEY` | yes | Bulk drafting model (BYOK). |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | one of | Strategic reasoning model (Anthropic preferred). |
| `GOOGLE_ACCESS_TOKEN` | yes | Read-only OAuth token for GSC + GA4. |
| `GA4_PROPERTY_ID` | yes | Numeric GA4 property id. |
| `SITE_URL` | yes | Canonical site origin. |
| `GSC_SITE_URL` | no | Search Console property URL (defaults to `SITE_URL`). |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | no | Enable the durable Supabase post store. |
| `POSTS_TABLE` | no | Supabase posts table name (default `posts`). |
| `POST_STORE_PATH` | no | JSON-file store path when Supabase is not configured. |
| `PUBLISH_WEBHOOK_URL` | no | Enable the CMS publisher; omit for a dry run. |
| `PUBLISH_WEBHOOK_TOKEN` | no | Request-scoped bearer token for the publish webhook. |
| `DEPLOY_HOOK_URL` | no | Deploy hook pinged after a successful publish. |
| `MAX_NEW_POSTS_PER_RUN`, `UNDERPERFORMANCE_THRESHOLD`, `DEDUP_THRESHOLD` | no | Pipeline tuning. |
| `CONTENT_PILLARS`, `COMPETITORS`, `AUDIENCE`, `VOICE` | no | Strategy seed. |

BYOK keys and service credentials live only in memory for the duration of a run; they are never
persisted and never logged. The returned `RunSummary` is log-safe.

## Built on

`@advance-labs/google-api` (GSC + GA4), `@advance-labs/llm` (BYOK completions), `@advance-labs/storage` (Supabase), `@advance-labs/types`.
