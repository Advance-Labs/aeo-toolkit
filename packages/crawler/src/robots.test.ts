import { describe, it, expect } from 'vitest';
import { parseRobotsTxt, emptyRobotsTxt } from './robots.js';
import { AI_BOT_NAMES } from './constants.js';

const ROBOTS_URL = 'https://example.com/robots.txt';

describe('parseRobotsTxt', () => {
  it('extracts sitemaps and reflects the raw text', () => {
    const raw = [
      'User-agent: *',
      'Disallow: /private',
      'Allow: /private/public',
      'Sitemap: https://example.com/sitemap.xml',
      'Sitemap: https://example.com/news-sitemap.xml',
    ].join('\n');

    const result = parseRobotsTxt(raw, ROBOTS_URL);

    expect(result.exists).toBe(true);
    expect(result.url).toBe(ROBOTS_URL);
    expect(result.sitemaps).toEqual([
      'https://example.com/sitemap.xml',
      'https://example.com/news-sitemap.xml',
    ]);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.userAgents).toEqual(['*']);
    expect(result.groups[0]?.disallow).toContain('/private');
    expect(result.groups[0]?.allow).toContain('/private/public');
  });

  it('produces an aiBotDirective for every known AI bot', () => {
    const result = parseRobotsTxt('User-agent: *\nDisallow:', ROBOTS_URL);
    expect(result.aiBotDirectives).toHaveLength(AI_BOT_NAMES.length);
    const bots = result.aiBotDirectives.map((d) => d.bot).sort();
    expect(bots).toEqual([...AI_BOT_NAMES].sort());
  });

  it('marks an AI bot disallowed when robots.txt blocks it at the root', () => {
    const raw = ['User-agent: GPTBot', 'Disallow: /', '', 'User-agent: *', 'Disallow:'].join('\n');

    const result = parseRobotsTxt(raw, ROBOTS_URL);
    const gptbot = result.aiBotDirectives.find((d) => d.bot === 'GPTBot');
    const claude = result.aiBotDirectives.find((d) => d.bot === 'ClaudeBot');

    expect(gptbot?.allowed).toBe(false);
    // Not mentioned → no matching rule → allowed by the standard.
    expect(claude?.allowed).toBe(true);
  });

  it('treats AI bots as allowed when no rule matches (edge: empty robots.txt body)', () => {
    const result = parseRobotsTxt('   \n  ', ROBOTS_URL);
    // Whitespace-only body: nothing exists, every bot allowed by default.
    expect(result.exists).toBe(false);
    expect(result.aiBotDirectives.every((d) => d.allowed)).toBe(true);
    expect(result.sitemaps).toEqual([]);
  });

  it('groups multiple user-agents and parses crawl-delay', () => {
    const raw = [
      '# comment line',
      'User-agent: Googlebot',
      'User-agent: Bingbot',
      'Crawl-delay: 5',
      'Disallow: /admin',
    ].join('\n');

    const result = parseRobotsTxt(raw, ROBOTS_URL);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.userAgents).toEqual(['Googlebot', 'Bingbot']);
    expect(result.groups[0]?.crawlDelay).toBe(5);
    expect(result.groups[0]?.disallow).toEqual(['/admin']);
  });
});

describe('emptyRobotsTxt', () => {
  it('returns a non-existent robots with all AI bots allowed', () => {
    const result = emptyRobotsTxt(ROBOTS_URL);
    expect(result.exists).toBe(false);
    expect(result.sitemaps).toEqual([]);
    expect(result.groups).toEqual([]);
    expect(result.aiBotDirectives).toHaveLength(AI_BOT_NAMES.length);
    expect(result.aiBotDirectives.every((d) => d.allowed)).toBe(true);
  });
});
