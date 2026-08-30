/**
 * Self-correction agent — rewrite / retitle / requeue underperformers.
 *
 * Looks at monitored posts, selects ones whose health score is below a threshold, and asks the
 * reasoning model to propose an improved title and a rewritten body. Posts that have already been
 * revised too many times are archived instead. Pure-ish: the LLM call is injected; selection logic
 * is fully testable with no network.
 */
import type { LlmCompletionRequest } from '@advance-labs/types';
import type { CompleteFn } from '../llm/client.js';
import { fingerprint } from './dedup.js';
import { stripFrontMatter } from './editor.js';
import type { ModelChoice, Post } from '../types.js';

export interface SelfCorrectionInput {
  posts: Post[];
  /** Posts with health.score strictly below this are candidates. */
  threshold: number;
  /** Max rewrites before a post is archived instead of rewritten again. */
  maxRevisions: number;
  model: ModelChoice;
  /** Cap on how many posts to rewrite per run (cost control). */
  maxRewritesPerRun: number;
}

export interface SelfCorrectionResult {
  /** Posts rewritten this run (status reset to `drafted` for re-edit/re-schedule). */
  rewritten: Post[];
  /** Posts archived because they exhausted their revision budget. */
  archived: Post[];
  /** Slugs identified as underperforming (rewritten ∪ archived ∪ skipped-over-budget). */
  flagged: string[];
}

/** A published post is a candidate when it has a health snapshot below the threshold. */
export function isUnderperformer(post: Post, threshold: number): boolean {
  return post.status === 'published' && post.health !== undefined && post.health.score < threshold;
}

/** Rank underperformers worst-first (lowest score), tie-break by impressions desc (more to gain). */
export function selectCandidates(posts: Post[], threshold: number): Post[] {
  return posts
    .filter((p) => isUnderperformer(p, threshold))
    .sort((a, b) => {
      const sa = a.health?.score ?? 0;
      const sb = b.health?.score ?? 0;
      if (sa !== sb) return sa - sb;
      return (b.health?.impressions ?? 0) - (a.health?.impressions ?? 0);
    });
}

interface RewriteDraft {
  title: string;
  markdown: string;
}

/** Parse the model's rewrite response: a JSON object with a new title and body. */
export function parseRewrite(raw: string, fallbackTitle: string): RewriteDraft {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  try {
    const parsed: unknown = JSON.parse(cleaned);
    if (typeof parsed === 'object' && parsed !== null) {
      const obj = parsed as Record<string, unknown>;
      const title =
        typeof obj['title'] === 'string' && obj['title'].trim() ? obj['title'] : fallbackTitle;
      const markdown = typeof obj['markdown'] === 'string' ? obj['markdown'] : '';
      if (markdown.trim().length > 0) return { title, markdown };
    }
  } catch {
    // Not JSON — treat the whole response as the rewritten markdown body.
  }
  return { title: fallbackTitle, markdown: cleaned };
}

function buildPrompt(post: Post): LlmCompletionRequest['messages'] {
  const h = post.health;
  const diag = h
    ? `Current metrics — clicks ${h.clicks}, impressions ${h.impressions}, ctr ${h.ctr}, position ${h.position}, score ${h.score}.`
    : 'No metrics available.';
  return [
    {
      role: 'system',
      content:
        'You are an SEO turnaround editor. Improve an underperforming article: sharpen the title for ' +
        'click-through, strengthen the intro, and add depth where thin. Preserve the YAML front-matter. ' +
        'Respond with ONLY a JSON object {"title":string,"markdown":string}. No prose, no fences.',
    },
    {
      role: 'user',
      content: `${diag}\nPrimary keyword: ${post.primaryKeyword}\n\nArticle:\n${post.markdown}`,
    },
  ];
}

/**
 * Run self-correction. Candidates over their revision budget are archived; the rest (up to
 * `maxRewritesPerRun`) are rewritten via the reasoning model and reset to `drafted` so the normal
 * edit → schedule → publish flow reprocesses them. `now` is injected for deterministic tests.
 */
export async function runSelfCorrection(
  input: SelfCorrectionInput,
  complete: CompleteFn,
  now: () => Date = () => new Date(),
): Promise<SelfCorrectionResult> {
  const candidates = selectCandidates(input.posts, input.threshold);
  const rewritten: Post[] = [];
  const archived: Post[] = [];
  const flagged: string[] = [];

  for (const post of candidates) {
    flagged.push(post.slug);

    if (post.revisionCount >= input.maxRevisions) {
      archived.push({ ...post, status: 'archived', updatedAt: now().toISOString() });
      continue;
    }
    if (rewritten.length >= input.maxRewritesPerRun) continue;

    const req: LlmCompletionRequest = {
      provider: input.model.provider,
      model: input.model.model,
      apiKey: input.model.apiKey,
      temperature: 0.5,
      maxTokens: 2048,
      messages: buildPrompt(post),
    };
    const res = await complete(req);
    const draft = parseRewrite(res.text, post.title);
    const ts = now().toISOString();

    rewritten.push({
      ...post,
      title: draft.title,
      markdown: `${draft.markdown.trim()}\n`,
      fingerprint: fingerprint(stripFrontMatter(draft.markdown)),
      status: 'drafted',
      revisionCount: post.revisionCount + 1,
      updatedAt: ts,
    });
  }

  return { rewritten, archived, flagged };
}
