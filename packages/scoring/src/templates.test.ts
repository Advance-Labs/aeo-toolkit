import { describe, expect, it } from 'vitest';
import { generateTemplates } from './templates.js';
import { goodContext, poorContext } from './fixtures.js';

describe('generateTemplates', () => {
  it('generates templates only for files the site is missing', () => {
    const templates = generateTemplates(poorContext());
    const filenames = templates.map((t) => t.filename).sort();
    expect(filenames).toEqual(['llms.txt', 'robots.txt', 'sitemap.xml']);
  });

  it('generates nothing when all crawl-hint files are present', () => {
    expect(generateTemplates(goodContext())).toHaveLength(0);
  });

  it('produces a robots.txt that allows AI bots and references the sitemap', () => {
    const templates = generateTemplates(poorContext());
    const robots = templates.find((t) => t.filename === 'robots.txt');
    expect(robots).toBeDefined();
    expect(robots?.contentType).toBe('text/plain');
    expect(robots?.content).toContain('GPTBot');
    expect(robots?.content).toContain('ClaudeBot');
    expect(robots?.content).toContain('PerplexityBot');
    expect(robots?.content).toContain('Sitemap: http://poor.example.com/sitemap.xml');
  });

  it('produces a sitemap.xml seeded from crawled URLs with escaped locs', () => {
    const ctx = poorContext();
    const templates = generateTemplates(ctx);
    const sitemap = templates.find((t) => t.filename === 'sitemap.xml');
    expect(sitemap?.contentType).toBe('application/xml');
    expect(sitemap?.content).toContain('<urlset');
    // only the 200-ok root page should be included (404 + redirect-loop excluded by ok filter)
    expect(sitemap?.content).toContain('http://poor.example.com/');
    expect(sitemap?.content).not.toContain('http://poor.example.com/missing');
  });

  it('produces an llms.txt with the host as the H1', () => {
    const llms = generateTemplates(poorContext()).find((t) => t.filename === 'llms.txt');
    expect(llms?.content.startsWith('# poor.example.com')).toBe(true);
  });
});
