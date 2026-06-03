import { describe, expect, it } from 'vitest';
import { buildMessages, SYSTEM_PROMPT } from './prompt.js';

describe('buildMessages', () => {
  it('produces a system + user pair with the data and question embedded', () => {
    const messages = buildMessages({ dataContext: 'DATA-BLOCK', question: 'Why?' });
    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe('system');
    expect(messages[0]?.content).toBe(SYSTEM_PROMPT);
    expect(messages[1]?.role).toBe('user');
    expect(messages[1]?.content).toContain('DATA:');
    expect(messages[1]?.content).toContain('DATA-BLOCK');
    expect(messages[1]?.content).toContain('QUESTION: Why?');
  });
});
