import { describe, expect, it } from 'vitest';
import { sanitizeForPublish } from './sanitize.js';

const ALLOWED = 'https://customer.example';

describe('sanitizeForPublish (security H3/H2)', () => {
  it('strips <script> blocks and raw HTML tags', () => {
    const out = sanitizeForPublish('<script>steal()</script>Hello <b>world</b>', ALLOWED);
    expect(out).not.toContain('<script');
    expect(out).not.toContain('<b>');
    expect(out).toContain('Hello');
    expect(out).toContain('world');
  });

  it('keeps a markdown link to the agreed href', () => {
    const out = sanitizeForPublish(`See [our guide](${ALLOWED}) here`, ALLOWED);
    expect(out).toContain(`[our guide](${ALLOWED})`);
  });

  it('neutralizes a markdown link to any other href, keeping only the text', () => {
    const out = sanitizeForPublish('Click [free money](https://evil.example/phish) now', ALLOWED);
    expect(out).toContain('free money');
    expect(out).not.toContain('evil.example');
  });

  it('removes a bare foreign URL but keeps the agreed one', () => {
    const out = sanitizeForPublish(`ours ${ALLOWED} theirs https://evil.example/x`, ALLOWED);
    expect(out).toContain(ALLOWED);
    expect(out).not.toContain('evil.example');
  });
});
