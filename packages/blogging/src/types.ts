/**
 * Internal domain types for the blogging agent.
 *
 * Shapes that cross package boundaries (GSC/GA4 rows, LLM requests) come from `@advance-labs/types`.
 * Everything here is agent-local: posts, topic briefs, strategy, and the pipeline config.
 */
import type { LlmProvider } from '@advance-labs/types';

/** Lifecycle of a post as it moves through the pipeline. */
export type PostStatus =
  | 'brief' // a research brief exists, no draft yet
  | 'drafted' // writer produced markdown
  | 'edited' // editor pass complete
  | 'scheduled' // queued for a publish date
  | 'published' // pushed to the CMS/site
  | 'underperforming' // monitor flagged it
  | 'archived'; // retired by self-correction

/** A topic brief produced by the research agent — the writer's input. */
export interface TopicBrief {
  /** Stable slug, also the dedup/primary key. */
  slug: string;
  title: string;
  /** Primary target query (usually a GSC gap). */
  primaryKeyword: string;
  /** Secondary queries to weave in. */
  secondaryKeywords: string[];
  /** One-line angle / intent. */
  intent: string;
  /** Internal-link targets (slugs of existing posts). */
  internalLinks: string[];
  /** Opportunity score in [0,1] from the research agent. */
  opportunityScore: number;
}

/** A blog post record persisted in the PostStore. */
export interface Post {
  slug: string;
  title: string;
  primaryKeyword: string;
  status: PostStatus;
  /** Markdown body once drafted; empty for brief-only records. */
  markdown: string;
  /** Jaccard fingerprint (sorted token shingles) used for dedup. */
  fingerprint: string[];
  /** ISO timestamps. */
  createdAt: string;
  updatedAt: string;
  /** Set when scheduled; ISO date (YYYY-MM-DD). */
  scheduledFor?: string;
  /** Set when published. */
  publishedAt?: string;
  /** Canonical URL once published. */
  url?: string;
  /** Latest health snapshot from the monitor agent. */
  health?: PostHealth;
  /** Number of self-correction rewrites applied so far. */
  revisionCount: number;
}

/** Per-post performance snapshot from GSC + GA4. */
export interface PostHealth {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  pageViews: number;
  /** Composite health score in [0,1]; lower means a self-correction candidate. */
  score: number;
  measuredAt: string;
}

/** One-time competitor / pillar strategy, produced by the strategy agent. */
export interface Strategy {
  /** The site we publish to. */
  siteUrl: string;
  /** Content pillars (broad themes). */
  pillars: string[];
  /** Competitor root domains tracked for sitemap research. */
  competitors: string[];
  /** Target audience descriptor used to steer the writer. */
  audience: string;
  /** Brand voice / tone guidance. */
  voice: string;
  generatedAt: string;
}

/** Which model + provider to use for a given stage (cost-split). */
export interface ModelChoice {
  provider: LlmProvider;
  model: string;
  /** BYOK key, request-scoped. Resolved from env at run time, never persisted. */
  apiKey: string;
}

/** Resolved runtime configuration for one pipeline run. */
export interface AgentConfig {
  siteUrl: string;
  /** GSC property URL (often equals siteUrl). */
  gscSiteUrl: string;
  /** GA4 numeric property id. */
  ga4PropertyId: string;
  /** Bulk drafting model (cheap, high-throughput — Groq). */
  draftModel: ModelChoice;
  /** Strategic reasoning model (stronger — Anthropic/OpenAI). */
  reasoningModel: ModelChoice;
  /** Google OAuth access token for GSC/GA4 reads. */
  googleAccessToken: string;
  /** How many new drafts to attempt per run. */
  maxNewPostsPerRun: number;
  /** Posts whose health.score is below this are self-correction candidates. */
  underperformanceThreshold: number;
  /** Jaccard similarity at/above which a brief is considered a duplicate. */
  dedupThreshold: number;
}
