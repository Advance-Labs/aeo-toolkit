import { describe, expect, it } from 'vitest';
import { normalizeUrl, parseCliArgs } from './args.js';

describe('parseCliArgs', () => {
  it('applies defaults and normalizes a bare domain', () => {
    expect(parseCliArgs(['example.com'])).toEqual({
      kind: 'run',
      options: { url: 'https://example.com/', pages: 10, json: false, failUnder: undefined },
    });
  });

  it('reads flags', () => {
    const r = parseCliArgs(['http://a.test/x', '--pages', '5', '--json', '--fail-under', '80']);
    expect(r).toEqual({ kind: 'run', options: { url: 'http://a.test/x', pages: 5, json: true, failUnder: 80 } });
  });

  it.each([['0'], ['51'], ['abc'], ['-3']])('rejects --pages %s', (n) => {
    expect(parseCliArgs(['a.com', `--pages=${n}`]).kind).toBe('error');
  });

  it('rejects bad --fail-under, missing url, unknown flag, extra args', () => {
    expect(parseCliArgs(['a.com', '--fail-under', '101']).kind).toBe('error');
    expect(parseCliArgs([]).kind).toBe('error');
    expect(parseCliArgs(['a.com', '--nope']).kind).toBe('error');
    expect(parseCliArgs(['a.com', 'b.com']).kind).toBe('error');
  });

  it('returns help', () => {
    expect(parseCliArgs(['-h']).kind).toBe('help');
  });

  it('only allows http(s)', () => {
    expect(normalizeUrl('ftp://a.com')).toBeUndefined();
    expect(normalizeUrl('file:///etc/passwd')).toBeUndefined();
  });
});
