/**
 * Orchestrator — wires the agents into one autonomous pipeline run.
 *
 * Stages per run:
 *   1. monitor    — refresh health for published posts (GSC + GA4).
 *   2. correct    — rewrite/requeue/archive underperformers (reasoning model).
 *   3. research   — find GSC query gaps → fresh topic briefs (deduped against the store).
 *   4. write      — draft each brief (Groq, bulk).
 *   5. edit       — lint + polish each draft.
 *   6. schedule   — queue edited posts onto publish dates.
 *   7. publish    — push posts that are due today (the only side effect).
 *
 * The pipeline is a dependency-injected function so it is fully testable with mocked agents/stores.
 * `main()` builds the production wiring from the environment and invokes it.
 */
import type { CompleteFn } from './llm/client.js';
import { defaultComplete } from './llm/client.js';
import type { Ga4ReportFn } from './google/ga4.js';
import { makeGa4Report } from './google/ga4.js';
import type { GscQueryFn } from './google/gsc.js';
import { makeGscQuery } from './google/gsc.js';
import { runMonitor } from './agents/monitor.js';
import { runResearch } from './agents/research.js';
import { runWriter } from './agents/writer.js';
import { runEditor } from './agents/editor.js';
import { duePosts, runScheduler } from './agents/scheduler.js';
import { runSelfCorrection } from './agents/self-correction.js';
import type { PostStore } from './store/PostStore.js';
import { InMemoryPostStore, JsonFilePostStore } from './store/PostStore.js';
import { nodeFileIO } from './store/node-file-io.js';
import type { Publisher } from './publish/Publisher.js';
import { CmsPublisher, NoopPublisher } from './publish/Publisher.js';
import { loadConfig } from './config.js';
import type { Env } from './config.js';
import type { AgentConfig, Post, Strategy } from './types.js';

/** Everything the pipeline needs, injected so the run is testable without I/O. */
export interface PipelineDeps {
  config: AgentConfig;
  strategy: Strategy;
  store: PostStore;
  publisher: Publisher;
  complete: CompleteFn;
  gscQuery: GscQueryFn;
  ga4Report: Ga4ReportFn;
  /** Injectable clock for deterministic scheduling/timestamps. */
  now?: () => Date;
}

/** A structured, log-safe summary of one run (contains no secrets). */
export interface RunSummary {
  monitored: number;
  flaggedUnderperformers: number;
  rewritten: number;
  archived: number;
  newBriefs: number;
  drafted: number;
  edited: number;
  scheduled: number;
  published: number;
  publishedSlugs: string[];
}

/** Lookback window (days) for monitor/research GSC + GA4 queries. */
const LOOKBACK_DAYS = 28;
const MS_PER_DAY = 86_400_000;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Run the full pipeline once. Pure orchestration over injected dependencies. */
export async function runPipeline(deps: PipelineDeps): Promise<RunSummary> {
  const now = deps.now ?? (() => new Date());
  const today = isoDate(now());
  const start = isoDate(new Date(now().getTime() - LOOKBACK_DAYS * MS_PER_DAY));

  const summary: RunSummary = {
    monitored: 0,
    flaggedUnderperformers: 0,
    rewritten: 0,
    archived: 0,
    newBriefs: 0,
    drafted: 0,
    edited: 0,
    scheduled: 0,
    published: 0,
    publishedSlugs: [],
  };

  // 1. Monitor — refresh health for published posts.
  const existing = await deps.store.all();
  const monitored = await runMonitor(
    {
      posts: existing,
      gscSiteUrl: deps.config.gscSiteUrl,
      ga4PropertyId: deps.config.ga4PropertyId,
      startDate: start,
      endDate: today,
    },
    deps.gscQuery,
    deps.ga4Report,
    now,
  );
  await deps.store.upsertMany(monitored);
  summary.monitored = monitored.filter((p) => p.status === 'published').length;

  // 2. Self-correction — rewrite/requeue/archive underperformers.
  const correction = await runSelfCorrection(
    {
      posts: monitored,
      threshold: deps.config.underperformanceThreshold,
      maxRevisions: 2,
      model: deps.config.reasoningModel,
      maxRewritesPerRun: deps.config.maxNewPostsPerRun,
    },
    deps.complete,
    now,
  );
  await deps.store.upsertMany([...correction.rewritten, ...correction.archived]);
  summary.flaggedUnderperformers = correction.flagged.length;
  summary.rewritten = correction.rewritten.length;
  summary.archived = correction.archived.length;

  // 3. Research — fresh briefs from GSC query gaps, deduped against the store.
  const corpus = await deps.store.fingerprints();
  const briefs = await runResearch(
    {
      strategy: deps.strategy,
      gscSiteUrl: deps.config.gscSiteUrl,
      startDate: start,
      endDate: today,
      corpus,
      dedupThreshold: deps.config.dedupThreshold,
      limit: deps.config.maxNewPostsPerRun,
    },
    deps.gscQuery,
  );
  summary.newBriefs = briefs.length;

  // 4. Write — draft each brief (Groq, bulk).
  const drafts: Post[] = [];
  for (const brief of briefs) {
    const post = await runWriter(
      { brief, strategy: deps.strategy, model: deps.config.draftModel },
      deps.complete,
      now,
    );
    drafts.push(post);
  }

  // Drafts also include any posts the self-correction step reset to `drafted`.
  const toEdit = [...correction.rewritten, ...drafts];
  summary.drafted = drafts.length;

  // 5. Edit — lint + polish each draft (reasoning model for the polish pass).
  const edited: Post[] = [];
  for (const draft of toEdit) {
    const result = await runEditor(
      { post: draft, model: deps.config.reasoningModel },
      deps.complete,
      now,
    );
    edited.push(result.post);
  }
  summary.edited = edited.length;

  // 6. Schedule — queue edited posts onto publish dates, skipping occupied slots.
  const allPosts = await deps.store.all();
  const occupied = allPosts.map((p) => p.scheduledFor).filter((d): d is string => d !== undefined);
  const opportunityBySlug = Object.fromEntries(briefs.map((b) => [b.slug, b.opportunityScore]));
  const scheduled = runScheduler(
    {
      posts: edited,
      cadenceDays: 2,
      occupiedDates: occupied,
      opportunityBySlug,
    },
    now,
  );
  await deps.store.upsertMany(scheduled);
  summary.scheduled = scheduled.length;

  // 7. Publish — push posts due today (the only true side effect).
  const refreshed = await deps.store.all();
  const due = duePosts(refreshed, today);
  for (const post of due) {
    const result = await deps.publisher.publish(post);
    const published: Post = {
      ...post,
      status: 'published',
      url: result.url,
      publishedAt: result.publishedAt,
      updatedAt: now().toISOString(),
    };
    await deps.store.upsert(published);
    summary.published += 1;
    summary.publishedSlugs.push(post.slug);
  }

  return summary;
}

/**
 * Build production dependencies from the environment and run one pipeline pass.
 *
 * Wiring choices:
 *   - PostStore: `JsonFilePostStore` at `POST_STORE_PATH` (default `./data/posts.json`).
 *   - Publisher: `CmsPublisher` when publish credentials are present, else `NoopPublisher` (dry run).
 *   - Strategy: loaded from the store-adjacent strategy via env, or a minimal default seeded here.
 */
export async function main(env: Env = process.env): Promise<RunSummary> {
  const config = loadConfig(env);

  const storePath = env['POST_STORE_PATH'] ?? './data/posts.json';
  const store = new JsonFilePostStore(storePath, nodeFileIO);

  const publisher = makePublisher(env, config);
  const complete = defaultComplete;
  const gscQuery = makeGscQuery(config.googleAccessToken);
  const ga4Report = makeGa4Report(config.googleAccessToken);
  const strategy = makeStrategy(env, config);

  const summary = await runPipeline({
    config,
    strategy,
    store,
    publisher,
    complete,
    gscQuery,
    ga4Report,
  });

  // Log-safe: the summary contains no secrets.
  console.log('[blogging-agent] run complete', JSON.stringify(summary));
  return summary;
}

function makePublisher(env: Env, config: AgentConfig): Publisher {
  const token = env['PUBLISH_TOKEN'];
  const target = env['PUBLISH_TARGET'];
  if (token && target) {
    return new CmsPublisher({
      baseUrl: config.siteUrl,
      target,
      token,
      ...(env['VERCEL_DEPLOY_HOOK_URL'] ? { deployHookUrl: env['VERCEL_DEPLOY_HOOK_URL'] } : {}),
    });
  }
  // No publish credentials → dry run.
  return new NoopPublisher(config.siteUrl);
}

function makeStrategy(env: Env, config: AgentConfig): Strategy {
  const pillars = (env['CONTENT_PILLARS'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const competitors = (env['COMPETITORS'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    siteUrl: config.siteUrl,
    pillars: pillars.length > 0 ? pillars : ['general'],
    competitors,
    audience: env['AUDIENCE'] ?? 'a general professional readership',
    voice: env['VOICE'] ?? 'clear, authoritative, and practical',
    generatedAt: new Date().toISOString(),
  };
}

/** Re-export the in-memory store so dry-run callers/tests can import from the entry. */
export { InMemoryPostStore };

// Execute when run directly (`node dist/run.js`), not when imported.
const isDirectRun =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] !== undefined &&
  /run\.(js|ts)$/.test(process.argv[1]);

if (isDirectRun) {
  main().catch((err: unknown) => {
    // Never log credentials; only the error message/stack.
    console.error('[blogging-agent] run failed:', err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
