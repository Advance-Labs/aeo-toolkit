import { describe, expect, it, vi } from 'vitest';
import type { ContentProposal } from '@aeo/types';
import { buildPostFromProposal, publishApprovedContent } from './publish.js';

const NOW = (): Date => new Date('2026-06-29T00:00:00.000Z');

function proposal(markdown: string): ContentProposal {
  return {
    id: 'p1',
    customerId: 'c1',
    ownerId: 'o1',
    kind: 'content',
    status: 'pending',
    createdAt: NOW().toISOString(),
    payload: { title: 'T', slug: 'my-slug', markdown, targetQuery: 'kw', wordCount: 100, confidence: 0.9 },
  };
}

describe('buildPostFromProposal', () => {
  it('maps proposal fields to a Post and sanitizes the markdown', () => {
    const post = buildPostFromProposal(proposal('hi [x](https://evil.example)'), 'https://me.example', NOW);
    expect(post.slug).toBe('my-slug');
    expect(post.title).toBe('T');
    expect(post.primaryKeyword).toBe('kw');
    expect(post.status).toBe('published');
    expect(post.markdown).not.toContain('evil.example');
  });
});

describe('publishApprovedContent', () => {
  it('publishes a sanitized post through the injected publisher', async () => {
    const publish = vi.fn(async () => ({
      slug: 'my-slug',
      url: 'https://me.example/blog/my-slug',
      publishedAt: NOW().toISOString(),
    }));
    const result = await publishApprovedContent(
      proposal('see https://evil.example/x'),
      'https://me.example',
      { publish },
    );
    expect(publish).toHaveBeenCalledOnce();
    const passedPost = publish.mock.calls[0]![0];
    expect(passedPost.markdown).not.toContain('evil.example');
    expect(result.url).toContain('me.example');
  });
});
