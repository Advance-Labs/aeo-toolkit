/**
 * @advance-labs/blogging — the autonomous multi-agent blogging pipeline, as a reusable package.
 *
 * Public surface: a top-level {@link runBloggingPipeline} that resolves all seams from the
 * environment and runs one pass, the dependency-injected {@link runPipeline} core, the agents,
 * the `PostStore`/`Publisher` contracts with their implementations, and the env-gated
 * `getPostStore`/`getPublisher` factories. All I/O is injected, so the package can be driven
 * in-process with mocked dependencies and stays fully testable with no network.
 */

// Orchestrator
export { runBloggingPipeline, runPipeline, InMemoryPostStore } from './run.js';
export type { PipelineDeps, RunSummary } from './run.js';

// Config
export { loadConfig, resolveDraftModel, resolveReasoningModel, ConfigError } from './config.js';
export type { Env } from './config.js';

// Agents
export { runStrategy, parseStrategyJson, StrategyParseError } from './agents/strategy.js';
export type { StrategyInput } from './agents/strategy.js';
export {
  runResearch,
  findQueryGaps,
  scoreGap,
  gapToBrief,
  DEFAULT_GAP_THRESHOLDS,
} from './agents/research.js';
export type { ResearchInput, GapThresholds, QueryGap } from './agents/research.js';
export { runWriter, withFrontMatter, WriterEmptyDraftError } from './agents/writer.js';
export type { WriterInput } from './agents/writer.js';
export { runEditor, lint, stripFrontMatter, MIN_WORD_COUNT } from './agents/editor.js';
export type { EditorInput, EditorResult, EditReport, EditIssue } from './agents/editor.js';
export { runScheduler, duePosts, addDays, toIsoDate } from './agents/scheduler.js';
export type { ScheduleInput } from './agents/scheduler.js';
export { runMonitor, healthScore, normalizePath, postPath } from './agents/monitor.js';
export type { MonitorInput } from './agents/monitor.js';
export {
  runSelfCorrection,
  selectCandidates,
  isUnderperformer,
  parseRewrite,
} from './agents/self-correction.js';
export type { SelfCorrectionInput, SelfCorrectionResult } from './agents/self-correction.js';

// Dedup primitives
export {
  fingerprint,
  jaccard,
  tokenize,
  checkDuplicate,
  DEFAULT_SHINGLE_SIZE,
} from './agents/dedup.js';
export type { DedupCandidate, DedupMatch, DedupResult } from './agents/dedup.js';

// Store
export {
  InMemoryPostStore as MemoryPostStore,
  JsonFilePostStore,
  SupabasePostStore,
  PostStoreError,
  getPostStore,
  postToRow,
  rowToPost,
  parsePosts,
} from './store/PostStore.js';
export type {
  PostStore,
  FileIO,
  SupabaseLike,
  SupabasePostStoreConfig,
  PostRow,
} from './store/PostStore.js';
export { nodeFileIO } from './store/node-file-io.js';

// Publisher
export {
  NoopPublisher,
  CmsPublisher,
  PublishError,
  joinUrl,
  getPublisher,
} from './publish/Publisher.js';
export type {
  Publisher,
  PublishResult,
  CmsPublisherConfig,
  PublishWebhookPayload,
  FetchLike,
  FetchResponseLike,
} from './publish/Publisher.js';

// Seams
export { defaultComplete } from './llm/client.js';
export type { CompleteFn } from './llm/client.js';
export { makeGscQuery } from './google/gsc.js';
export type { GscQueryFn } from './google/gsc.js';
export { makeGa4Report } from './google/ga4.js';
export type { Ga4ReportFn } from './google/ga4.js';
export { slugify } from './util/slug.js';

// Domain types
export type {
  AgentConfig,
  ModelChoice,
  Post,
  PostHealth,
  PostStatus,
  Strategy,
  TopicBrief,
} from './types.js';
