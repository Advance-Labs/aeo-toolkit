import { describe, expect, it } from 'vitest';
import type { LlmMessage } from '@aeo/types';
import { buildMessages, extractCitations } from './helpers.js';

describe('buildMessages', () => {
  it('hoists system turns and preserves chat order', () => {
    const messages: LlmMessage[] = [
      { role: 'system', content: 'be terse' },
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
      { role: 'user', content: 'bye' },
    ];

    const built = buildMessages(messages);

    expect(built.system).toBe('be terse');
    expect(built.chat).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
      { role: 'user', content: 'bye' },
    ]);
  });

  it('joins multiple system turns and returns undefined when none exist (edge case)', () => {
    const merged = buildMessages([
      { role: 'system', content: 'rule a' },
      { role: 'system', content: 'rule b' },
      { role: 'user', content: 'go' },
    ]);
    expect(merged.system).toBe('rule a\n\nrule b');

    const none = buildMessages([{ role: 'user', content: 'go' }]);
    expect(none.system).toBeUndefined();
    expect(none.chat).toHaveLength(1);
  });
});

describe('extractCitations', () => {
  it('normalizes bare URL strings', () => {
    const citations = extractCitations(['https://a.com', '  https://b.com  ']);
    expect(citations).toEqual([{ url: 'https://a.com' }, { url: 'https://b.com' }]);
  });

  it('reads object form with title/snippet and skips malformed entries (edge case)', () => {
    const citations = extractCitations([
      { url: 'https://a.com', title: 'A', snippet: 'about a' },
      { url: '', title: 'empty' },
      { title: 'no url' },
      42,
      null,
      'https://c.com',
    ]);

    expect(citations).toEqual([
      { url: 'https://a.com', title: 'A', snippet: 'about a' },
      { url: 'https://c.com' },
    ]);
  });

  it('returns an empty array when input is not an array (edge case)', () => {
    expect(extractCitations(undefined)).toEqual([]);
    expect(extractCitations('https://a.com')).toEqual([]);
    expect(extractCitations({ url: 'https://a.com' })).toEqual([]);
  });
});
