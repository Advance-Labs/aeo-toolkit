import { describe, expect, it, vi } from 'vitest';
import type {
  Ga4Report,
  Ga4ReportRequest,
  GscQueryRequest,
  GscReport,
  LlmCompletionRequest,
  LlmCompletionResponse,
} from '@aeo/types';
import type { Ga4ReportFn } from './google/ga4.js';
import type { GscQueryFn } from './google/gsc.js';
import type { CompleteFn } from './llm/client.js';
import { InMemoryPostStore } from './store/PostStore.js';
import { NoopPublisher } from './publish/Publisher.js';
import { fingerprint } from './agents/dedup.js';
import { runPipeline } from './run.js';
import type { AgentConfig, Post, Strategy } from './types.js';

const NOW = () => new Date('2026-06-03T00:00:00.000Z');

const CONFIG: AgentConfig = {
  siteUrl: 'https://example.com',
  gscSiteUrl: 'https://example.com/',
  ga4PropertyId: '123456',
  draftModel: { provider: 'groq', model: 'llama-3.3-70b-versatile', apiKey: 'groq-key' },
  reasoningModel: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKey: 'anthropic-key',
  },
  googleAccessToken: 'unused-in-mock',
  maxNewPostsPerRun: 2,
  underperformanceThreshold: 0.3,
  dedupThreshold: 0.8,
};

const STRATEGY: Strategy = {
  siteUrl: 'https://example.com',
  pillars: ['answer engine optimization'],
  competitors: [],
  audience: 'SEO practitioners',
  voice: 'practical',
  generatedAt: '2026-01-01T00:00:00.000Z',
};

/** A drafted article body long enough to clear the editor's word-count gate. */
const ARTICLE =
  '# Generated Title\n\n' +
  'Sentence about the topic. '.repeat(60) +
  '\n\n## Section\n\nMore detail here.\n\nSee [related](/blog/related).';

function ga4(report: Ga4Report): Ga4ReportFn {
  return vi.fn((_req: Ga4ReportRequest): Promise<Ga4Report> => Promise.resolve(report));
}

/** Mock LLM: returns the canned article for every call (writer + editor polish). */
function llm(): CompleteFn {
  return vi.fn(
    (req: LlmCompletionRequest): Promise<LlmCompletionResponse> =>
      Promise.resolve({ text: ARTICLE, model: req.model }),
  );
}

describe('runPipeline', () => {
  it('researches gaps, drafts, edits, schedules, and publishes due posts end-to-end', async () => {
    const store = new InMemoryPostStore();
    const publisher = new NoopPublisher('https://example.com', NOW);

    // One strong query gap → one brief → one draft.
    const gscByQuery: GscReport = {
      rows: [
        {
          keys: ['answer engine optimization'],
          clicks: 2,
          impressions: 1500,
          ctr: 0.001,
          position: 12,
        },
      ],
    };
    // The page-dimension query for monitoring has no published pages yet.
    const gscByPage: GscReport = { rows: [] };
    const ga4Report: Ga4Report = { rows: [], rowCount: 0 };

    // The research agent and the monitor agent both call gscQuery, but with different dimensions.
    const gscQuery: GscQueryFn = vi.fn((req: GscQueryRequest): Promise<GscReport> => {
      return Promise.resolve(req.dimensions?.[0] === 'page' ? gscByPage : gscByQuery);
    });

    const summary = await runPipeline({
      config: CONFIG,
      strategy: STRATEGY,
      store,
      publisher,
      complete: llm(),
      gscQuery,
      ga4Report: ga4(ga4Report),
      now: NOW,
    });

    expect(summary.newBriefs).toBe(1);
    expect(summary.drafted).toBe(1);
    expect(summary.edited).toBe(1);
    expect(summary.scheduled).toBe(1);

    const stored = await store.all();
    expect(stored).toHaveLength(1);
    const article = stored[0];
    expect(article?.slug).toBe('answer-engine-optimization');
    // First-run schedule starts tomorrow, so it is not due today and stays scheduled.
    expect(article?.status).toBe('scheduled');
    expect(summary.published).toBe(0);
  });

  it('publishes a post that is already due today and flags an underperformer', async () => {
    // Seed a published underperformer and a separately due scheduled post.
    const underperformer: Post = {
      slug: 'old-post',
      title: 'Old Post',
      primaryKeyword: 'old topic',
      status: 'published',
      markdown: '---\ntitle: "Old Post"\n---\n# Old Post\n\nbody old topic [x](/blog/y)',
      fingerprint: fingerprint('old post body old topic'),
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      publishedAt: '2026-01-01T00:00:00.000Z',
      url: 'https://example.com/blog/old-post',
      revisionCount: 0,
    };
    const due: Post = {
      slug: 'due-post',
      title: 'Due Post',
      primaryKeyword: 'due topic',
      status: 'scheduled',
      markdown: '---\ntitle: "Due Post"\n---\n# Due\n\nbody',
      fingerprint: fingerprint('due post body'),
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
      scheduledFor: '2026-06-02', // before "today" (2026-06-03)
      revisionCount: 0,
    };
    const store = new InMemoryPostStore([underperformer, due]);

    // Monitor: GSC page row giving old-post a poor position; GA4 with zero views → low score.
    const gscByPage: GscReport = {
      rows: [{ keys: ['/blog/old-post'], clicks: 0, impressions: 30, ctr: 0, position: 40 }],
    };
    const gscQuery: GscQueryFn = vi.fn(
      (req: GscQueryRequest): Promise<GscReport> =>
        Promise.resolve(req.dimensions?.[0] === 'page' ? gscByPage : { rows: [] }),
    );
    const publisher = new NoopPublisher('https://example.com', NOW);

    const summary = await runPipeline({
      config: CONFIG,
      strategy: STRATEGY,
      store,
      publisher,
      complete: llm(),
      gscQuery,
      ga4Report: ga4({ rows: [], rowCount: 0 }),
      now: NOW,
    });

    expect(summary.flaggedUnderperformers).toBeGreaterThanOrEqual(1);
    expect(summary.published).toBeGreaterThanOrEqual(1);
    expect(summary.publishedSlugs).toContain('due-post');

    const published = await store.get('due-post');
    expect(published?.status).toBe('published');
    expect(published?.url).toBe('https://example.com/blog/due-post');
  });
});
