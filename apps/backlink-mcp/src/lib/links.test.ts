import { describe, it, expect } from 'vitest';
import { normalizeDomain, hostMatchesDomain, verifyLinks } from './links.js';

describe('normalizeDomain', () => {
  it('strips scheme, path, port, and leading www', () => {
    expect(normalizeDomain('https://www.Example.com:8080/path?q=1')).toBe('example.com');
    expect(normalizeDomain('Example.COM')).toBe('example.com');
    expect(normalizeDomain('sub.example.com')).toBe('sub.example.com');
  });
});

describe('hostMatchesDomain', () => {
  it('matches the apex and subdomains, not unrelated hosts', () => {
    expect(hostMatchesDomain('example.com', 'example.com')).toBe(true);
    expect(hostMatchesDomain('www.example.com', 'example.com')).toBe(true);
    expect(hostMatchesDomain('docs.example.com', 'example.com')).toBe(true);
    expect(hostMatchesDomain('notexample.com', 'example.com')).toBe(false);
    expect(hostMatchesDomain('example.com.evil.com', 'example.com')).toBe(false);
  });
});

describe('verifyLinks', () => {
  it('counts all links but only matches the target domain', () => {
    const html = `
      <a href="/relative">rel</a>
      <a href="https://other.com">o</a>
      <a href="https://target.com/a">t1</a>
      <a href="https://www.target.com/b" rel="nofollow">t2</a>
    `;
    const out = verifyLinks(html, 'https://host.example/page', 'target.com');
    expect(out.totalLinksOnPage).toBe(4);
    expect(out.matches).toHaveLength(2);
    expect(out.linkFound).toBe(true);
    expect(out.dofollowFound).toBe(true);
    const nofollowMatch = out.matches.find((m) => m.nofollow);
    expect(nofollowMatch?.dofollow).toBe(false);
  });

  it('ignores non-http(s) schemes', () => {
    const html = `<a href="mailto:x@target.com">mail</a><a href="javascript:void(0)">js</a>`;
    const out = verifyLinks(html, 'https://host.example/', 'target.com');
    expect(out.matches).toHaveLength(0);
  });
});
