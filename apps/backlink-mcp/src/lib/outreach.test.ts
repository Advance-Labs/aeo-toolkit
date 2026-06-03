import { describe, it, expect } from 'vitest';
import type { LlmCompletionRequest } from '@aeo/types';
import {
  buildOutreachMessages,
  splitEmail,
  generateOutreach,
  type OutreachClient,
  type OutreachRequest,
} from './outreach.js';

const baseReq: OutreachRequest = {
  contact: { name: 'Jane Doe', site: 'jane.blog', role: 'Editor' },
  context: {
    fromBrand: 'Acme',
    fromName: 'Sam',
    reason: 'Our guide complements your resource page on widgets.',
    targetUrl: 'https://acme.com/widgets-guide',
    notes: 'Loved your recent post on gadgets.',
  },
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  apiKey: 'sk-test-REDACTED',
};

describe('buildOutreachMessages', () => {
  it('produces a system + user message embedding the contact and context', () => {
    const messages = buildOutreachMessages(baseReq);
    expect(messages[0]?.role).toBe('system');
    expect(messages[1]?.role).toBe('user');
    const user = messages[1]?.content ?? '';
    expect(user).toContain('Jane Doe');
    expect(user).toContain('Acme');
    expect(user).toContain('resource page on widgets');
    expect(user).toContain('https://acme.com/widgets-guide');
  });

  it('does not leak the api key into the prompt', () => {
    const user = buildOutreachMessages(baseReq)[1]?.content ?? '';
    expect(user).not.toContain('sk-test-REDACTED');
  });
});

describe('splitEmail', () => {
  it('splits an explicit Subject: line from the body', () => {
    const { subject, body } = splitEmail('Subject: Quick idea\n\nHi Jane,\nGreat work.');
    expect(subject).toBe('Quick idea');
    expect(body).toContain('Hi Jane');
  });

  it('falls back to the first line as subject when no Subject: prefix', () => {
    const { subject, body } = splitEmail('A short note\nrest of body');
    expect(subject).toBe('A short note');
    expect(body).toContain('rest of body');
  });
});

describe('generateOutreach', () => {
  it('forwards the BYOK key to the LLM client and parses the result', async () => {
    let captured: LlmCompletionRequest | undefined;
    const client: OutreachClient = {
      complete: async (req) => {
        captured = req;
        return { text: 'Subject: Hello\n\nHi Jane, here is my pitch.', model: req.model };
      },
    };

    const result = await generateOutreach(client, baseReq);

    expect(captured?.apiKey).toBe('sk-test-REDACTED');
    expect(captured?.provider).toBe('anthropic');
    expect(captured?.messages).toHaveLength(2);
    expect(result.subject).toBe('Hello');
    expect(result.body).toContain('Hi Jane');
    expect(result.model).toBe('claude-sonnet-4-20250514');
  });
});
