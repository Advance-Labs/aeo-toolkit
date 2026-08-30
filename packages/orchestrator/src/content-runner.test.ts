import { describe, it, expect } from 'vitest';
import type { GscReport, LlmCompletionRequest, LlmCompletionResponse } from '@advance-labs/types';
import type { CompleteFn, GscQueryFn, ModelChoice } from '@advance-labs/blogging';
import type { CustomerProfile } from '@advance-labs/types';
import {
  ContentRunnerImpl,
  scoreConfidence,
  validateContentPayload,
} from './content-runner.js';
import type { EditReport } from '@advance-labs/blogging';

const MODEL: ModelChoice = { provider: 'groq', model: 'test-model', apiKey: 'byok-test' };

function profile(overrides: Partial<CustomerProfile> = {}): CustomerProfile {
  return {
    id: 'c1',
    ownerId: 'o1',
    siteUrl: 'https://example.com',
    niche: 'kanban software',
    topics: ['kanban'],
    cadence: { articlesPerMonth: 4, outreachPlacementsPerMonth: 2 },
    integrations: {},
    ...overrides,
  };
}

// A GSC report with one clear gap (high impressions, weak position).
const gscQuery: GscQueryFn = (): Promise<GscReport> =>
  Promise.resolve({
    rows: [
      { keys: ['kanban board templates'], clicks: 2, impressions: 800, ctr: 0.004, position: 12 },
    ],
  });

// A clean, lint-passing article so the editor short-circuits (no second LLM call).
const CLEAN_BODY = [
  '# Kanban board templates',
  '',
  'An intro about kanban board templates and how teams use them every day to ship work.',
  '',
  '## Why templates help',
  '',
  Array.from({ length: 120 }, (_, i) => `Point ${i} about kanban board templates and flow.`).join(' '),
  '',
  'See our [kanban guide](/blog/kanban-guide) for more.',
  '',
  '## Conclusion',
  '',
  'Kanban board templates speed teams up.',
].join('\n');

const complete: CompleteFn = (req: LlmCompletionRequest): Promise<LlmCompletionResponse> =>
  Promise.resolve({ text: CLEAN_BODY, model: req.model });

function makeRunner() {
  let n = 0;
  return new ContentRunnerImpl({
    complete,
    gscQuery,
    draftModel: MODEL,
    reasoningModel: MODEL,
    now: () => new Date('2026-06-29T00:00:00.000Z'),
    newId: () => `id_${++n}`,
  });
}

describe('ContentRunnerImpl.run', () => {
  it('emits a ContentProposal with the expected shape', async () => {
    const runner = makeRunner();
    const proposals = await runner.run({
      profile: profile(),
      period: '2026-06',
      limit: 5,
      startDate: '2026-06-01',
      endDate: '2026-06-29',
    });
    expect(proposals).toHaveLength(1);
    const p = proposals[0]!;
    expect(p.kind).toBe('content');
    expect(p.status).toBe('pending');
    expect(p.customerId).toBe('c1');
    expect(p.ownerId).toBe('o1');
    expect(p.id).toBe('id_1');
    expect(p.createdAt).toBe('2026-06-29T00:00:00.000Z');
    expect(p.payload.targetQuery).toBe('kanban board templates');
    expect(p.payload.slug).toBe('kanban-board-templates');
    expect(p.payload.markdown).toContain('# Kanban board templates');
    expect(p.payload.wordCount).toBeGreaterThan(300);
    expect(p.payload.confidence).toBeGreaterThan(0);
    expect(p.payload.confidence).toBeLessThanOrEqual(1);
  });

  it('respects the proposal limit', async () => {
    const manyGaps: GscQueryFn = (): Promise<GscReport> =>
      Promise.resolve({
        rows: [
          { keys: ['kanban board templates'], clicks: 1, impressions: 800, ctr: 0.004, position: 12 },
          { keys: ['scrum vs kanban'], clicks: 1, impressions: 900, ctr: 0.004, position: 14 },
          { keys: ['agile boards'], clicks: 1, impressions: 700, ctr: 0.004, position: 11 },
        ],
      });
    const runner = new ContentRunnerImpl({
      complete,
      gscQuery: manyGaps,
      draftModel: MODEL,
      reasoningModel: MODEL,
      now: () => new Date('2026-06-29T00:00:00.000Z'),
      newId: (() => {
        let n = 0;
        return () => `id_${++n}`;
      })(),
    });
    const proposals = await runner.run({
      profile: profile(),
      period: '2026-06',
      limit: 2,
      startDate: '2026-06-01',
      endDate: '2026-06-29',
    });
    expect(proposals).toHaveLength(2);
  });

  it('skips a brief whose draft fails output validation (empty body)', async () => {
    const emptyComplete: CompleteFn = (req): Promise<LlmCompletionResponse> =>
      Promise.resolve({ text: '   ', model: req.model });
    const runner = new ContentRunnerImpl({
      complete: emptyComplete,
      gscQuery,
      draftModel: MODEL,
      reasoningModel: MODEL,
      now: () => new Date('2026-06-29T00:00:00.000Z'),
      newId: () => 'id_x',
    });
    const proposals = await runner.run({
      profile: profile(),
      period: '2026-06',
      limit: 5,
      startDate: '2026-06-01',
      endDate: '2026-06-29',
    });
    expect(proposals).toEqual([]);
  });
});

describe('scoreConfidence', () => {
  const clean: EditReport = { issues: [], wordCount: 900 };
  const messy: EditReport = {
    issues: [
      { code: 'too-short', message: '' },
      { code: 'missing-h1', message: '' },
      { code: 'no-headings', message: '' },
    ],
    wordCount: 120,
  };

  it('rates a clean long draft higher than a messy short one', () => {
    expect(scoreConfidence(clean, 0.5)).toBeGreaterThan(scoreConfidence(messy, 0.5));
  });

  it('stays within [0,1]', () => {
    expect(scoreConfidence(clean, 1)).toBeLessThanOrEqual(1);
    expect(scoreConfidence(messy, 0)).toBeGreaterThanOrEqual(0);
  });

  it('a clean long draft on a solid opportunity can clear an 0.85 auto-publish bar', () => {
    expect(scoreConfidence(clean, 0.6)).toBeGreaterThanOrEqual(0.85);
  });
});

describe('validateContentPayload', () => {
  it('accepts a well-formed payload', () => {
    expect(
      validateContentPayload({
        title: 'T',
        slug: 't',
        markdown: '# T\n\nbody',
        targetQuery: 't',
        wordCount: 400,
        confidence: 0.5,
      }),
    ).toBe(true);
  });

  it('rejects empty markdown / zero words / out-of-range confidence', () => {
    const base = { title: 'T', slug: 't', markdown: '# T', targetQuery: 't', wordCount: 1, confidence: 0.5 };
    expect(validateContentPayload({ ...base, markdown: '   ' })).toBe(false);
    expect(validateContentPayload({ ...base, wordCount: 0 })).toBe(false);
    expect(validateContentPayload({ ...base, confidence: 1.5 })).toBe(false);
    expect(validateContentPayload({ ...base, title: '' })).toBe(false);
  });
});
