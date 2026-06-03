import { describe, expect, it } from 'vitest';
import { parseChatRequest } from './chat-types.js';

const valid = {
  question: 'Where are my CTR gaps?',
  propertyId: '123456',
  siteUrl: 'https://example.com/',
  llmProvider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  apiKey: 'sk-test',
};

describe('parseChatRequest', () => {
  it('accepts and trims a valid body', () => {
    const result = parseChatRequest({ ...valid, question: '  hi  ' });
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.question).toBe('hi');
      expect(result.llmProvider).toBe('anthropic');
    }
  });

  it('rejects a non-object body', () => {
    expect(parseChatRequest(null)).toEqual({ error: expect.any(String) });
    expect(parseChatRequest('nope')).toEqual({ error: expect.any(String) });
  });

  it('rejects an unknown provider', () => {
    const result = parseChatRequest({ ...valid, llmProvider: 'bard' });
    expect('error' in result).toBe(true);
    if ('error' in result) expect(result.error).toMatch(/llmProvider/);
  });

  it.each(['question', 'propertyId', 'siteUrl', 'model', 'apiKey'] as const)(
    'rejects a missing %s',
    (field) => {
      const body: Record<string, unknown> = { ...valid };
      delete body[field];
      const result = parseChatRequest(body);
      expect('error' in result).toBe(true);
    },
  );
});
