import { describe, it, expect } from 'vitest';
import { extractLinks, sameOrigin, sameRegistrableSite, hostOf } from './links.js';

const BASE = 'https://example.com/blog/';

describe('extractLinks', () => {
  it('extracts and absolutizes hrefs, stripping fragments and deduping', () => {
    const html = `
      <a href="/about">About</a>
      <a href='post-1'>Post 1</a>
      <a href="https://example.com/about#section">About again</a>
      <a href="https://other.com/x">External</a>
    `;
    const links = extractLinks(html, BASE);
    expect(links).toEqual([
      'https://example.com/about',
      'https://example.com/blog/post-1',
      'https://other.com/x',
    ]);
  });

  it('ignores non-http schemes and pure fragments (edge case)', () => {
    const html = `
      <a href="mailto:me@example.com">mail</a>
      <a href="tel:+123">call</a>
      <a href="javascript:void(0)">js</a>
      <a href="#top">top</a>
      <a href="ftp://example.com/file">ftp</a>
      <a href="/real">real</a>
    `;
    const links = extractLinks(html, BASE);
    expect(links).toEqual(['https://example.com/real']);
  });

  it('returns an empty list for empty or link-free html (edge case)', () => {
    expect(extractLinks('', BASE)).toEqual([]);
    expect(extractLinks('<p>no links here</p>', BASE)).toEqual([]);
  });

  it('handles single-quoted and unquoted href values', () => {
    const html = `<a href='/single'>s</a><a href=/bare>b</a>`;
    const links = extractLinks(html, BASE);
    expect(links).toContain('https://example.com/single');
    expect(links).toContain('https://example.com/bare');
  });
});

describe('sameOrigin', () => {
  it('is true for same-origin and false across hosts or schemes', () => {
    expect(sameOrigin('https://example.com/x', 'https://example.com/')).toBe(true);
    expect(sameOrigin('https://sub.example.com/x', 'https://example.com/')).toBe(false);
    expect(sameOrigin('http://example.com/x', 'https://example.com/')).toBe(false);
  });
});

describe('sameRegistrableSite', () => {
  it('treats subdomains as the same site but rejects unrelated hosts', () => {
    expect(sameRegistrableSite('https://blog.example.com/x', 'https://example.com/')).toBe(true);
    expect(sameRegistrableSite('https://example.com/x', 'https://example.com/')).toBe(true);
    expect(sameRegistrableSite('https://notexample.com/x', 'https://example.com/')).toBe(false);
  });
});

describe('hostOf', () => {
  it('returns the host, or empty string for an unparseable url (edge case)', () => {
    expect(hostOf('https://example.com:8080/x')).toBe('example.com:8080');
    expect(hostOf('not a url')).toBe('');
  });
});
