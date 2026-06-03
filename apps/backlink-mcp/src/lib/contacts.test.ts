import { describe, it, expect } from 'vitest';
import { extractEmails, extractSocials, extractContacts } from './contacts.js';

describe('extractEmails', () => {
  it('extracts plain and mailto emails, de-duplicated and lowercased', () => {
    const html = `
      <p>Reach us at Hello@Example-Site.com or via
      <a href="mailto:Sales@example-site.com">sales</a>.</p>
      <p>Again: hello@example-site.com</p>
    `;
    const emails = extractEmails(html);
    expect(emails).toContain('hello@example-site.com');
    expect(emails).toContain('sales@example-site.com');
    // de-duplicated
    expect(emails.filter((e) => e === 'hello@example-site.com')).toHaveLength(1);
  });

  it('de-obfuscates "name [at] domain [dot] com" patterns', () => {
    const html = 'Contact: jane [at] acme [dot] io for press.';
    expect(extractEmails(html)).toContain('jane@acme.io');
  });

  it('ignores asset paths and denylisted/example hosts', () => {
    const html = `
      <img src="logo@2x.png">
      <span>foo@example.com</span>
      <span>noreply@sentry.io</span>
      <span>real@business.co</span>
    `;
    const emails = extractEmails(html);
    expect(emails).toContain('real@business.co');
    expect(emails).not.toContain('foo@example.com');
    expect(emails).not.toContain('noreply@sentry.io');
    expect(emails.some((e) => e.endsWith('.png'))).toBe(false);
  });

  it('returns an empty array when no emails are present', () => {
    expect(extractEmails('<p>no contact here</p>')).toEqual([]);
  });
});

describe('extractSocials', () => {
  const base = 'https://prospect.example';

  it('pulls handles from major networks and de-duplicates by network+handle', () => {
    const html = `
      <a href="https://twitter.com/acme">Twitter</a>
      <a href="https://x.com/acme">X (same handle)</a>
      <a href="https://www.linkedin.com/in/jane-doe">LinkedIn</a>
      <a href="https://github.com/acme-labs">GitHub</a>
      <a href="https://facebook.com/sharer/sharer.php?u=x">Share</a>
    `;
    const socials = extractSocials(html, base);
    const twitter = socials.filter((s) => s.network === 'twitter');
    expect(twitter).toHaveLength(1);
    expect(twitter[0]?.handle).toBe('acme');

    expect(socials.some((s) => s.network === 'github' && s.handle === 'acme-labs')).toBe(true);
    expect(socials.some((s) => s.network === 'linkedin')).toBe(true);
    // The facebook share/sharer link is chrome, not a handle.
    expect(socials.some((s) => s.network === 'facebook')).toBe(false);
  });

  it('resolves relative and protocol-relative hrefs against the base url', () => {
    const html = '<a href="//instagram.com/brandname">IG</a>';
    const socials = extractSocials(html, base);
    expect(socials).toEqual([
      expect.objectContaining({ network: 'instagram', handle: 'brandname' }),
    ]);
  });
});

describe('extractContacts', () => {
  it('combines emails and socials', () => {
    const html = `
      <a href="mailto:owner@shop.dev">email</a>
      <a href="https://twitter.com/shop">tw</a>
    `;
    const result = extractContacts(html, 'https://shop.dev');
    expect(result.emails).toContain('owner@shop.dev');
    expect(result.socials.map((s) => s.network)).toContain('twitter');
  });
});
