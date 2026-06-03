import { describe, expect, it, vi } from 'vitest';
import type { LlmCompletionRequest, LlmCompletionResponse } from '@aeo/types';
import type { CompleteFn } from '../llm/client.js';
import type { ModelChoice, Post, PostHealth } from '../types.js';
import {
  isUnderperformer,
  parseRewrite,
  runSelfCorrection,
  selectCandidates,
} from './self-correction.js';

const MODEL: ModelChoice = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  apiKey: 'k',
};

function health(score: number, impressions = 100): PostHealth {
  return {
    clicks: 1,
    impressions,
    ctr: 0.01,
    position: 30,
    pageViews: 5,
    score,
    measuredAt: '2026-06-01',
  };
}

function post(slug: string, overrides: Partial<Post> = {}): Post {
  return {
    slug,
    title: slug,
    primaryKeyword: slug,
    status: 'published',
    markdown: `---\ntitle: "${slug}"\n---\n# ${slug}\n\nbody`,
    fingerprint: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    revisionCount: 0,
    ...overrides,
  };
}

const NOW = () => new Date('2026-06-03T00:00:00.000Z');

describe('isUnderperformer / selectCandidates', () => {
  it('only treats published posts below the threshold as candidates', () => {
    expect(isUnderperformer(post('a', { health: health(0.1) }), 0.3)).toBe(true);
    expect(isUnderperformer(post('a', { health: health(0.9) }), 0.3)).toBe(false);
    expect(isUnderperformer(post('a', { status: 'drafted', health: health(0.1) }), 0.3)).toBe(
      false,
    );
    expect(isUnderperformer(post('a'), 0.3)).toBe(false); // no health snapshot
  });

  it('ranks worst score first, tie-breaking by impressions desc', () => {
    const posts = [
      post('mid', { health: health(0.2, 100) }),
      post('worst-a', { health: health(0.1, 50) }),
      post('worst-b', { health: health(0.1, 500) }),
    ];
    expect(selectCandidates(posts, 0.3).map((p) => p.slug)).toEqual(['worst-b', 'worst-a', 'mid']);
  });
});

describe('parseRewrite', () => {
  it('parses a JSON rewrite object', () => {
    const out = parseRewrite('{"title":"New","markdown":"# New\\n\\nbody"}', 'Old');
    expect(out.title).toBe('New');
    expect(out.markdown).toContain('# New');
  });

  it('falls back to raw text as markdown when not JSON', () => {
    const out = parseRewrite('# Just markdown\n\nbody', 'Fallback');
    expect(out.title).toBe('Fallback');
    expect(out.markdown).toContain('Just markdown');
  });
});

describe('runSelfCorrection', () => {
  it('rewrites under-budget underperformers via the mocked LLM and resets them to drafted', async () => {
    const complete: CompleteFn = vi.fn(
      (req: LlmCompletionRequest): Promise<LlmCompletionResponse> =>
        Promise.resolve({
          text: '{"title":"Improved Title","markdown":"# Improved\\n\\nbetter body"}',
          model: req.model,
        }),
    );
    const posts = [post('weak', { health: health(0.1), revisionCount: 0 })];

    const result = await runSelfCorrection(
      { posts, threshold: 0.3, maxRevisions: 2, model: MODEL, maxRewritesPerRun: 5 },
      complete,
      NOW,
    );

    expect(complete).toHaveBeenCalledTimes(1);
    expect(result.flagged).toEqual(['weak']);
    expect(result.rewritten).toHaveLength(1);
    expect(result.rewritten[0]?.status).toBe('drafted');
    expect(result.rewritten[0]?.title).toBe('Improved Title');
    expect(result.rewritten[0]?.revisionCount).toBe(1);
    expect(result.archived).toHaveLength(0);
  });

  it('archives posts that exhausted their revision budget without calling the LLM', async () => {
    const complete: CompleteFn = vi.fn();
    const posts = [post('exhausted', { health: health(0.05), revisionCount: 2 })];

    const result = await runSelfCorrection(
      { posts, threshold: 0.3, maxRevisions: 2, model: MODEL, maxRewritesPerRun: 5 },
      complete,
      NOW,
    );

    expect(complete).not.toHaveBeenCalled();
    expect(result.archived).toHaveLength(1);
    expect(result.archived[0]?.status).toBe('archived');
    expect(result.rewritten).toHaveLength(0);
  });

  it('respects the per-run rewrite cap', async () => {
    const complete: CompleteFn = vi.fn(
      (req: LlmCompletionRequest): Promise<LlmCompletionResponse> =>
        Promise.resolve({ text: 'rewritten body', model: req.model }),
    );
    const posts = [
      post('a', { health: health(0.1, 300) }),
      post('b', { health: health(0.1, 200) }),
      post('c', { health: health(0.1, 100) }),
    ];

    const result = await runSelfCorrection(
      { posts, threshold: 0.3, maxRevisions: 5, model: MODEL, maxRewritesPerRun: 1 },
      complete,
      NOW,
    );

    expect(result.rewritten).toHaveLength(1);
    expect(result.flagged).toHaveLength(3); // all three are flagged even if not all rewritten
  });
});
