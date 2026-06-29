import { describe, it, expect } from 'vitest';
import type { ContentProposal, LinkOutreachProposal } from '@aeo/types';
import { shouldAutoExecute, DEFAULT_AUTONOMY_POLICY } from './autonomy.js';

function content(confidence: number): ContentProposal {
  return {
    id: 'p1',
    customerId: 'c1',
    ownerId: 'o1',
    kind: 'content',
    status: 'pending',
    createdAt: '2026-06-29T00:00:00.000Z',
    payload: {
      title: 'A Title',
      slug: 'a-title',
      markdown: '# A Title\n\nbody',
      targetQuery: 'a title',
      wordCount: 400,
      confidence,
    },
  };
}

function outreach(): LinkOutreachProposal {
  return {
    id: 'p2',
    customerId: 'c1',
    ownerId: 'o1',
    kind: 'link-outreach',
    status: 'pending',
    createdAt: '2026-06-29T00:00:00.000Z',
    payload: {
      prospectUrl: 'https://blog.example.org/write-for-us',
      prospectDomain: 'blog.example.org',
      outreachSubject: 'Collaboration',
      outreachBody: 'Hello',
    },
  };
}

describe('shouldAutoExecute', () => {
  const policy = { contentAutoPublishThreshold: 0.8 };

  it('auto-executes content at or above the confidence threshold', () => {
    expect(shouldAutoExecute(content(0.8), policy)).toBe(true);
    expect(shouldAutoExecute(content(0.95), policy)).toBe(true);
  });

  it('does not auto-execute content below the confidence threshold', () => {
    expect(shouldAutoExecute(content(0.79), policy)).toBe(false);
    expect(shouldAutoExecute(content(0), policy)).toBe(false);
  });

  it('NEVER auto-executes link-outreach, regardless of policy', () => {
    expect(shouldAutoExecute(outreach(), policy)).toBe(false);
    expect(shouldAutoExecute(outreach(), { contentAutoPublishThreshold: 0 })).toBe(false);
  });

  it('ships a conservative default threshold', () => {
    expect(DEFAULT_AUTONOMY_POLICY.contentAutoPublishThreshold).toBeGreaterThanOrEqual(0.8);
    expect(shouldAutoExecute(content(0.5), DEFAULT_AUTONOMY_POLICY)).toBe(false);
  });
});
