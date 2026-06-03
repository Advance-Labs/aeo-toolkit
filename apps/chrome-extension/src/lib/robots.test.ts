import { describe, expect, it } from 'vitest';
import { parseRobotsTxt } from './robots.js';

const URL = 'https://example.com/robots.txt';

describe('parseRobotsTxt', () => {
  it('marks a missing robots.txt as non-existent with all AI bots allowed', () => {
    const result = parseRobotsTxt(null, URL);
    expect(result.exists).toBe(false);
    expect(result.groups).toHaveLength(0);
    expect(result.aiBotDirectives.every((d) => d.allowed)).toBe(true);
  });

  it('parses groups, sitemaps and comments', () => {
    const raw = [
      '# top comment',
      'User-agent: *',
      'Disallow: /admin',
      'Allow: /admin/public',
      'Crawl-delay: 5',
      '',
      'Sitemap: https://example.com/sitemap.xml',
    ].join('\n');

    const result = parseRobotsTxt(raw, URL);
    expect(result.exists).toBe(true);
    expect(result.sitemaps).toEqual(['https://example.com/sitemap.xml']);
    expect(result.groups).toHaveLength(1);
    const group = result.groups[0];
    expect(group?.userAgents).toEqual(['*']);
    expect(group?.disallow).toEqual(['/admin']);
    expect(group?.allow).toEqual(['/admin/public']);
    expect(group?.crawlDelay).toBe(5);
  });

  it('reports a specific AI bot as blocked when it has a Disallow: / group', () => {
    const raw = ['User-agent: GPTBot', 'Disallow: /', '', 'User-agent: *', 'Disallow:'].join('\n');
    const result = parseRobotsTxt(raw, URL);
    const gptbot = result.aiBotDirectives.find((d) => d.bot === 'GPTBot');
    const claude = result.aiBotDirectives.find((d) => d.bot === 'ClaudeBot');
    expect(gptbot?.allowed).toBe(false);
    // ClaudeBot falls under the wildcard group which allows everything.
    expect(claude?.allowed).toBe(true);
  });

  it('groups consecutive user-agents together', () => {
    const raw = ['User-agent: GPTBot', 'User-agent: CCBot', 'Disallow: /'].join('\n');
    const result = parseRobotsTxt(raw, URL);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.userAgents).toEqual(['GPTBot', 'CCBot']);
    expect(result.aiBotDirectives.find((d) => d.bot === 'GPTBot')?.allowed).toBe(false);
    expect(result.aiBotDirectives.find((d) => d.bot === 'CCBot')?.allowed).toBe(false);
  });
});
