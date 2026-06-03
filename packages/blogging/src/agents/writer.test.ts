import { describe, expect, it, vi } from 'vitest';
import type { LlmCompletionRequest, LlmCompletionResponse } from '@aeo/types';
import type { CompleteFn } from '../llm/client.js';
import type { ModelChoice, Strategy, TopicBrief } from '../types.js';
import { runWriter, WriterEmptyDraftError, withFrontMatter } from './writer.js';

const MODEL: ModelChoice = {
  provider: 'groq',
  model: 'llama-3.3-70b-versatile',
  apiKey: 'test-key',
};

const STRATEGY: Strategy = {
  siteUrl: 'https://example.com',
  pillars: ['answer engine optimization'],
  competitors: [],
  audience: 'SEO practitioners',
  voice: 'practical and direct',
  generatedAt: '2026-01-01T00:00:00.000Z',
};

const BRIEF: TopicBrief = {
  slug: 'optimize-blog-answer-engines',
  title: 'Optimize Blog Answer Engines',
  primaryKeyword: 'optimize blog answer engines',
  secondaryKeywords: ['answer engine optimization'],
  intent: 'Capture organic demand for the query.',
  internalLinks: ['aeo-basics'],
  opportunityScore: 0.8,
};

/** A mock that records the request and returns canned markdown — no @aeo/llm, no network. */
function mockComplete(text: string): { fn: CompleteFn; calls: LlmCompletionRequest[] } {
  const calls: LlmCompletionRequest[] = [];
  const fn = vi.fn((req: LlmCompletionRequest): Promise<LlmCompletionResponse> => {
    calls.push(req);
    return Promise.resolve({ text, model: req.model });
  });
  return { fn, calls };
}

const NOW = () => new Date('2026-06-01T12:00:00.000Z');

describe('runWriter', () => {
  it('drafts a post from a brief using the injected (mocked) LLM', async () => {
    const body =
      '# Optimize Blog Answer Engines\n\nIntro.\n\n## Why\n\nBody text about optimize blog answer engines.\n\nSee [basics](/blog/aeo-basics).';
    const { fn, calls } = mockComplete(body);

    const post = await runWriter({ brief: BRIEF, strategy: STRATEGY, model: MODEL }, fn, NOW);

    expect(post.slug).toBe('optimize-blog-answer-engines');
    expect(post.status).toBe('drafted');
    expect(post.revisionCount).toBe(0);
    expect(post.createdAt).toBe('2026-06-01T12:00:00.000Z');
    expect(post.markdown).toContain('---');
    expect(post.markdown).toContain(body.trim());
    expect(post.fingerprint.length).toBeGreaterThan(0);

    // Cost-split assertion: drafting routed to the cheap Groq model with the BYOK key.
    expect(calls).toHaveLength(1);
    expect(calls[0]?.provider).toBe('groq');
    expect(calls[0]?.apiKey).toBe('test-key');
    // The brief's internal-link target is surfaced to the model.
    expect(calls[0]?.messages.at(-1)?.content).toContain('/blog/aeo-basics');
  });

  it('throws WriterEmptyDraftError when the model returns nothing', async () => {
    const { fn } = mockComplete('   ');
    await expect(
      runWriter({ brief: BRIEF, strategy: STRATEGY, model: MODEL }, fn, NOW),
    ).rejects.toBeInstanceOf(WriterEmptyDraftError);
  });
});

describe('withFrontMatter', () => {
  it('prepends YAML front-matter with the slug and keyword', () => {
    const out = withFrontMatter(BRIEF, '# Title\n\nBody.');
    expect(out.startsWith('---\n')).toBe(true);
    expect(out).toContain('slug: "optimize-blog-answer-engines"');
    expect(out).toContain('keyword: "optimize blog answer engines"');
    expect(out.trimEnd().endsWith('Body.')).toBe(true);
  });
});
