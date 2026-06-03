import { describe, expect, it, vi } from 'vitest';
import type { LlmCompletionRequest, LlmCompletionResponse } from '@aeo/types';
import type { CompleteFn } from '../llm/client.js';
import type { Post } from '../types.js';
import { lint, runEditor, stripFrontMatter } from './editor.js';

function makePost(markdown: string, keyword = 'answer engine optimization'): Post {
  return {
    slug: 'aeo',
    title: 'AEO',
    primaryKeyword: keyword,
    status: 'drafted',
    markdown,
    fingerprint: [],
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    revisionCount: 0,
  };
}

const GOOD_BODY =
  '# Answer Engine Optimization\n\n' +
  // 120 reps × 3 words = 360 words, comfortably over the 300-word minimum the linter enforces.
  'A practical guide. '.repeat(120) +
  '\n\n## Why it matters\n\nDetails about answer engine optimization.\n\nSee [more](/blog/basics).';

const NOW = () => new Date('2026-06-01T00:00:00.000Z');

describe('stripFrontMatter', () => {
  it('removes a leading YAML block', () => {
    expect(stripFrontMatter('---\ntitle: x\n---\n# Body')).toBe('# Body');
    expect(stripFrontMatter('# No front matter')).toBe('# No front matter');
  });
});

describe('lint', () => {
  it('passes a well-formed article with no issues', () => {
    const report = lint(makePost(GOOD_BODY));
    expect(report.issues).toEqual([]);
    expect(report.wordCount).toBeGreaterThanOrEqual(300);
  });

  it('flags missing H1, missing keyword, short body, and no internal links', () => {
    const report = lint(makePost('Just a sentence.', 'missing keyword'));
    const codes = report.issues.map((i) => i.code).sort();
    expect(codes).toContain('missing-h1');
    expect(codes).toContain('keyword-missing');
    expect(codes).toContain('too-short');
    expect(codes).toContain('no-internal-links');
  });
});

describe('runEditor', () => {
  it('returns edited status with no LLM call when clean (lint-only)', async () => {
    const complete = vi.fn();
    const result = await runEditor(
      { post: makePost(GOOD_BODY) },
      complete as unknown as CompleteFn,
      NOW,
    );
    expect(result.revised).toBe(false);
    expect(result.post.status).toBe('edited');
    expect(complete).not.toHaveBeenCalled();
  });

  it('invokes the (mocked) LLM to polish when issues exist and applies the rewrite', async () => {
    const polished =
      '---\ntitle: "AEO"\n---\n# Answer Engine Optimization\n\nFixed body about answer engine optimization with [link](/blog/x).';
    const complete: CompleteFn = vi.fn(
      (req: LlmCompletionRequest): Promise<LlmCompletionResponse> =>
        Promise.resolve({ text: polished, model: req.model }),
    );
    const result = await runEditor(
      {
        post: makePost('# Title\n\nthin'),
        model: { provider: 'anthropic', model: 'claude-sonnet-4-20250514', apiKey: 'k' },
      },
      complete,
      NOW,
    );
    expect(complete).toHaveBeenCalledTimes(1);
    expect(result.revised).toBe(true);
    expect(result.post.markdown).toContain('Fixed body');
    expect(result.post.fingerprint.length).toBeGreaterThan(0);
  });
});
