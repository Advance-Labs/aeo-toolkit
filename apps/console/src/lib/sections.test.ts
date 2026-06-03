import { describe, expect, it } from 'vitest';
import type { LlmsTxtEntry } from '@aeo/types';
import { classifyUrl, groupIntoSections } from './sections.js';

describe('classifyUrl', () => {
  it('buckets docs / blog / product paths by their segments', () => {
    expect(classifyUrl('https://example.com/docs/start')).toBe('docs');
    expect(classifyUrl('https://example.com/guides/intro')).toBe('docs');
    expect(classifyUrl('https://example.com/blog/hello')).toBe('blog');
    expect(classifyUrl('https://example.com/news/2024')).toBe('blog');
    expect(classifyUrl('https://example.com/pricing')).toBe('product');
    expect(classifyUrl('https://example.com/products/widget')).toBe('product');
  });

  it('falls back to other for the homepage and unknown paths', () => {
    expect(classifyUrl('https://example.com/')).toBe('other');
    expect(classifyUrl('https://example.com/about')).toBe('other');
    expect(classifyUrl('not a url')).toBe('other');
  });
});

describe('groupIntoSections', () => {
  it('groups entries, drops empty buckets, and orders docs→blog→product→other', () => {
    const entries: LlmsTxtEntry[] = [
      { title: 'About', url: 'https://example.com/about' },
      { title: 'Start', url: 'https://example.com/docs/start' },
      { title: 'Post', url: 'https://example.com/blog/post' },
      { title: 'Pricing', url: 'https://example.com/pricing' },
      { title: 'API', url: 'https://example.com/docs/api' },
    ];

    const sections = groupIntoSections(entries);

    expect(sections.map((section) => section.heading)).toEqual([
      'Docs',
      'Blog',
      'Products',
      'Other',
    ]);
    const docs = sections.find((section) => section.heading === 'Docs');
    expect(docs?.entries.map((entry) => entry.title)).toEqual(['Start', 'API']);
  });

  it('returns no sections for an empty entry list', () => {
    expect(groupIntoSections([])).toEqual([]);
  });
});
