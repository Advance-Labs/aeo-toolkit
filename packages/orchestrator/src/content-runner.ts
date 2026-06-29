/**
 * ContentRunner — composes the `@aeo/blogging` sub-agents into a draft, then STOPS before
 * schedule/publish and emits a {@link ContentProposal}.
 *
 * It does NOT wrap `runBloggingPipeline`/`runPipeline` (which is single-tenant and publishes as its
 * final side effect — feasibility §0.5). Instead it composes, per customer:
 *
 *   findQueryGaps → gapToBrief  (both inside `runResearch`)  →  runWriter  →  runEditor
 *
 * and turns each edited draft into a pending proposal. Publishing happens later, only on approval
 * (or via the graduated auto-publish gate in the console execution layer).
 *
 * Per-customer wiring: the LLM (`complete`) and GSC seam (`gscQuery`) plus the BYOK {@link ModelChoice}s
 * are INJECTED — built from the customer's own key + Google token by the caller (see
 * {@link createLiveContentRunner}). Nothing reaches into a global env.
 *
 * Output safety (invariants 4 & 5): the research inputs here are the customer's own Search Console
 * rows (not third-party scraped text), so there is no external-prompt-injection surface; even so,
 * every produced payload is schema-validated by {@link validateContentPayload} and rejected on
 * mismatch — model output is never trusted as-is.
 */
import {
  runResearch,
  runWriter,
  runEditor,
  lint,
  defaultComplete,
  makeGscQuery,
  DEFAULT_GAP_THRESHOLDS,
} from '@aeo/blogging';
import type {
  CompleteFn,
  GscQueryFn,
  ModelChoice,
  Strategy,
  TopicBrief,
  EditReport,
  DedupCandidate,
} from '@aeo/blogging';
import type { ContentProposal, ContentProposalPayload, CustomerProfile } from '@aeo/types';
import { randomUUID } from 'node:crypto';

/** Per-customer dependencies for one content run (all injected; zero global env). */
export interface ContentRunnerDeps {
  /** Injected LLM seam (BYOK key carried in the model choices). */
  complete: CompleteFn;
  /** Injected GSC seam, bound to the customer's Google access token. */
  gscQuery: GscQueryFn;
  /** Bulk drafting model (BYOK). */
  draftModel: ModelChoice;
  /** Polish/reasoning model (BYOK). */
  reasoningModel: ModelChoice;
  /** Injected clock — no `Date.now()` in the core. */
  now: () => Date;
  /** Injected id generator — no `Math.random()` in the core. */
  newId: () => string;
}

export interface ContentRunnerInput {
  profile: CustomerProfile;
  /** Calendar period this run covers (idempotency window). */
  period: string;
  /** Max proposals to produce (the customer's monthly article target). */
  limit: number;
  /** GSC lookback window. */
  startDate: string;
  endDate: string;
  /** Optional dedup corpus (existing posts' fingerprints) to skip near-duplicate briefs. */
  corpus?: DedupCandidate[];
  /** Jaccard threshold above which a brief is a duplicate (default 0.8). */
  dedupThreshold?: number;
}

export interface ContentRunner {
  run(input: ContentRunnerInput): Promise<ContentProposal[]>;
}

const MAX_LINT_ISSUES = 5; // the number of distinct lint codes
const TARGET_WORDS = 800;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function round(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

/**
 * Heuristic 0–1 confidence for a draft, blending editor quality (lint cleanliness + length) with
 * the brief's opportunity score. Pure and deterministic — gates the graduated auto-publish path.
 */
export function scoreConfidence(report: EditReport, opportunityScore: number): number {
  const quality = 1 - Math.min(1, report.issues.length / MAX_LINT_ISSUES);
  const lengthFactor = clamp01(report.wordCount / TARGET_WORDS);
  const editorScore = 0.6 * quality + 0.4 * lengthFactor;
  return round(clamp01(0.7 * editorScore + 0.3 * clamp01(opportunityScore)));
}

/** Schema-validate a produced content payload; reject malformed model output (invariant 5). */
export function validateContentPayload(payload: ContentProposalPayload): boolean {
  return (
    typeof payload.title === 'string' &&
    payload.title.trim().length > 0 &&
    typeof payload.slug === 'string' &&
    payload.slug.trim().length > 0 &&
    typeof payload.markdown === 'string' &&
    payload.markdown.trim().length > 0 &&
    typeof payload.targetQuery === 'string' &&
    payload.targetQuery.length > 0 &&
    Number.isFinite(payload.wordCount) &&
    payload.wordCount > 0 &&
    Number.isFinite(payload.confidence) &&
    payload.confidence >= 0 &&
    payload.confidence <= 1
  );
}

/** Derive a blogging {@link Strategy} from the managed customer's profile. */
function strategyFor(profile: CustomerProfile, generatedAt: string): Strategy {
  const pillars = profile.topics.length > 0 ? profile.topics : ['general'];
  return {
    siteUrl: profile.siteUrl,
    pillars,
    competitors: [],
    audience: `readers interested in ${profile.niche}`,
    voice: 'clear, authoritative, and practical',
    generatedAt,
  };
}

export class ContentRunnerImpl implements ContentRunner {
  constructor(private readonly deps: ContentRunnerDeps) {}

  async run(input: ContentRunnerInput): Promise<ContentProposal[]> {
    const { deps } = this;
    const generatedAt = deps.now().toISOString();
    const strategy = strategyFor(input.profile, generatedAt);

    const briefs = await runResearch(
      {
        strategy,
        gscSiteUrl: input.profile.siteUrl,
        startDate: input.startDate,
        endDate: input.endDate,
        corpus: input.corpus ?? [],
        dedupThreshold: input.dedupThreshold ?? 0.8,
        limit: input.limit,
      },
      deps.gscQuery,
      DEFAULT_GAP_THRESHOLDS,
    );

    const proposals: ContentProposal[] = [];
    for (const brief of briefs) {
      const proposal = await this.draftOne(input.profile, brief);
      if (proposal !== null) proposals.push(proposal);
    }
    return proposals;
  }

  /** Draft → edit → validate one brief into a proposal, or null if the draft is unusable. */
  private async draftOne(
    profile: CustomerProfile,
    brief: TopicBrief,
  ): Promise<ContentProposal | null> {
    const { deps } = this;
    const strategy = strategyFor(profile, deps.now().toISOString());

    let editedMarkdown: string;
    let report: EditReport;
    try {
      const draft = await runWriter(
        { brief, strategy, model: deps.draftModel },
        deps.complete,
        deps.now,
      );
      const result = await runEditor(
        { post: draft, model: deps.reasoningModel },
        deps.complete,
        deps.now,
      );
      editedMarkdown = result.post.markdown;
      report = result.report;
    } catch {
      // A draft that fails to generate (e.g. an empty model response) is skipped, never fatal.
      return null;
    }

    // Recompute the lint report against the final markdown for a stable word count.
    const finalReport = lint({ markdown: editedMarkdown, primaryKeyword: brief.primaryKeyword });
    const payload: ContentProposalPayload = {
      title: brief.title,
      slug: brief.slug,
      markdown: editedMarkdown,
      targetQuery: brief.primaryKeyword,
      wordCount: finalReport.wordCount,
      confidence: scoreConfidence(report, brief.opportunityScore),
    };
    if (!validateContentPayload(payload)) return null;

    return {
      id: deps.newId(),
      customerId: profile.id,
      ownerId: profile.ownerId,
      kind: 'content',
      status: 'pending',
      createdAt: deps.now().toISOString(),
      payload,
    };
  }
}

/** Per-customer secrets the live content runner needs (request-scoped; never persisted). */
export interface LiveContentRunnerConfig {
  /** Customer's Google OAuth access token for GSC reads (from the hardened TokenStore). */
  googleAccessToken: string;
  /** Customer's BYOK drafting model. */
  draftModel: ModelChoice;
  /** Customer's BYOK reasoning model. */
  reasoningModel: ModelChoice;
  now?: () => Date;
  newId?: () => string;
}

/**
 * Production {@link ContentRunner}: wires `@aeo/blogging`'s real LLM (`defaultComplete`) and a
 * GSC seam bound to the customer's access token. Built per customer from injected secrets — it does
 * not read a global env. `now`/`newId` default to live wall-clock + UUID (this is the live edge,
 * not a pure core).
 */
export function createLiveContentRunner(config: LiveContentRunnerConfig): ContentRunner {
  return new ContentRunnerImpl({
    complete: defaultComplete,
    gscQuery: makeGscQuery(config.googleAccessToken),
    draftModel: config.draftModel,
    reasoningModel: config.reasoningModel,
    now: config.now ?? ((): Date => new Date()),
    newId: config.newId ?? ((): string => randomUUID()),
  });
}
