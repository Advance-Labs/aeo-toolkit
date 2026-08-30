import { describe, expect, it, vi } from 'vitest';
import type { LlmCompletionRequest, LlmCompletionResponse } from '@advance-labs/types';
import type { CompleteFn } from '../llm/client.js';
import type { ModelChoice } from '../types.js';
import { parseStrategyJson, runStrategy, StrategyParseError } from './strategy.js';

const MODEL: ModelChoice = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  apiKey: 'k',
};
const NOW = () => new Date('2026-06-01T00:00:00.000Z');

describe('parseStrategyJson', () => {
  it('parses a clean JSON object', () => {
    const out = parseStrategyJson(
      '{"pillars":["a","b"],"competitors":["x.com"],"audience":"devs","voice":"crisp"}',
    );
    expect(out.pillars).toEqual(['a', 'b']);
    expect(out.competitors).toEqual(['x.com']);
  });

  it('strips ```json fences', () => {
    const out = parseStrategyJson(
      '```json\n{"pillars":["only"],"competitors":[],"audience":"","voice":""}\n```',
    );
    expect(out.pillars).toEqual(['only']);
  });

  it('throws when there are no pillars', () => {
    expect(() => parseStrategyJson('{"pillars":[],"competitors":[]}')).toThrow(StrategyParseError);
  });
});

describe('runStrategy', () => {
  it('builds a Strategy from the mocked LLM and merges known competitors', async () => {
    const complete: CompleteFn = vi.fn(
      (req: LlmCompletionRequest): Promise<LlmCompletionResponse> =>
        Promise.resolve({
          text: '{"pillars":["aeo","seo"],"competitors":["b.com"],"audience":"marketers","voice":"direct"}',
          model: req.model,
        }),
    );

    const strategy = await runStrategy(
      {
        siteUrl: 'https://example.com',
        seedDescription: 'A blog about answer engine optimization.',
        knownCompetitors: ['a.com'],
        model: MODEL,
      },
      complete,
      NOW,
    );

    expect(strategy.siteUrl).toBe('https://example.com');
    expect(strategy.pillars).toEqual(['aeo', 'seo']);
    expect(strategy.competitors).toEqual(['a.com', 'b.com']);
    expect(strategy.generatedAt).toBe('2026-06-01T00:00:00.000Z');
    expect(complete).toHaveBeenCalledTimes(1);
  });
});
