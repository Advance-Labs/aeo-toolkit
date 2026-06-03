import { describe, expect, it, vi } from 'vitest';
import type {
  Ga4Report,
  Ga4ReportRequest,
  GscQueryRequest,
  GscReport,
  LlmCompletionRequest,
  LlmCompletionResponse,
} from '@aeo/types';
import { answerQuestion, type AnswerDeps } from './answer.js';
import type { ChatRequestBody } from './chat-types.js';

const ga4: Ga4Report = {
  rowCount: 1,
  rows: [{ dimensions: { pagePath: '/p' }, metrics: { screenPageViews: 100 } }],
};
const gsc: GscReport = {
  rows: [{ keys: ['q', '/p'], clicks: 1, impressions: 500, ctr: 0.002, position: 9 }],
};

const body: ChatRequestBody = {
  question: 'CTR gaps?',
  propertyId: '123',
  siteUrl: 'https://example.com/',
  llmProvider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  apiKey: 'sk-secret',
};

function makeDeps(): { deps: AnswerDeps; captured: { llm?: LlmCompletionRequest } } {
  const captured: { llm?: LlmCompletionRequest } = {};
  const deps: AnswerDeps = {
    fetchGa4: vi.fn(async (_req: Ga4ReportRequest) => ga4),
    fetchGsc: vi.fn(async (_req: GscQueryRequest) => gsc),
    complete: vi.fn(async (req: LlmCompletionRequest): Promise<LlmCompletionResponse> => {
      captured.llm = req;
      return { text: '1. Fix titles.', model: req.model };
    }),
  };
  return { deps, captured };
}

describe('answerQuestion', () => {
  it('fetches both reports, grounds the prompt, and returns the LLM answer', async () => {
    const { deps, captured } = makeDeps();
    const result = await answerQuestion(body, deps, {
      window: { startDate: '2024-01-01', endDate: '2024-01-28' },
    });

    expect(result.answer).toBe('1. Fix titles.');
    expect(result.model).toBe('claude-sonnet-4-20250514');
    expect(result.dataContext).toContain('Date range: 2024-01-01 to 2024-01-28');
    expect(result.dataContext).toContain('/p');

    expect(deps.fetchGa4).toHaveBeenCalledOnce();
    expect(deps.fetchGsc).toHaveBeenCalledOnce();

    // The BYOK key is forwarded to complete() and the data context is embedded in the user message.
    expect(captured.llm?.apiKey).toBe('sk-secret');
    expect(captured.llm?.provider).toBe('anthropic');
    const userMessage = captured.llm?.messages.find((m) => m.role === 'user');
    expect(userMessage?.content).toContain('QUESTION: CTR gaps?');
    expect(userMessage?.content).toContain('impressions');
  });

  it('passes the configured GA4 + GSC request shapes', async () => {
    const { deps } = makeDeps();
    await answerQuestion(body, deps, {
      window: { startDate: '2024-01-01', endDate: '2024-01-28' },
    });

    const ga4Call = (deps.fetchGa4 as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as Ga4ReportRequest;
    expect(ga4Call.propertyId).toBe('123');
    expect(ga4Call.metrics).toContain('engagementRate');

    const gscCall = (deps.fetchGsc as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as GscQueryRequest;
    expect(gscCall.siteUrl).toBe('https://example.com/');
    expect(gscCall.dimensions).toEqual(['query', 'page']);
  });

  it('propagates an upstream GA4/GSC error', async () => {
    const { deps } = makeDeps();
    deps.fetchGsc = vi.fn(async () => {
      throw new Error('gsc boom');
    });
    await expect(answerQuestion(body, deps)).rejects.toThrow('gsc boom');
  });
});
