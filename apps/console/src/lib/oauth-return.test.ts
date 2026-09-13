import { afterEach, describe, expect, it } from 'vitest';
import { allowedReturnOrigins, resolveReturnTo, withAuthResult } from './oauth-return.js';

const SELF = 'https://aeo.advancelabs.dev';
const ALLOWED = [SELF, 'https://advancelabs.dev'];
const FALLBACK = `${SELF}/tools/chat`;

describe('resolveReturnTo', () => {
  it('falls back when nothing was supplied', () => {
    expect(resolveReturnTo(null, ALLOWED, SELF)).toBe(FALLBACK);
    expect(resolveReturnTo(undefined, ALLOWED, SELF)).toBe(FALLBACK);
    expect(resolveReturnTo('', ALLOWED, SELF)).toBe(FALLBACK);
  });

  it('keeps a same-site path, query included', () => {
    expect(resolveReturnTo('/tools/chat?site=x', ALLOWED, SELF)).toBe(`${SELF}/tools/chat?site=x`);
  });

  it('keeps an absolute URL on an allowed origin (the proxying marketing site)', () => {
    expect(resolveReturnTo('https://advancelabs.dev/tools/chat', ALLOWED, SELF)).toBe(
      'https://advancelabs.dev/tools/chat',
    );
  });

  it.each([
    ['a foreign origin', 'https://evil.example/tools/chat'],
    ['a protocol-relative URL', '//evil.example/tools/chat'],
    ['a backslash host trick', '/\\evil.example/tools/chat'],
    ['a lookalike suffix domain', 'https://advancelabs.dev.evil.example/tools/chat'],
    ['an allowed host over plain http', 'http://advancelabs.dev/tools/chat'],
    ['a javascript: URL', 'javascript:alert(1)'],
  ])('rejects %s', (_label, raw) => {
    expect(resolveReturnTo(raw, ALLOWED, SELF)).toBe(FALLBACK);
  });
});

describe('withAuthResult', () => {
  it('marks success and drops a stale error', () => {
    expect(withAuthResult(`${SELF}/tools/chat?error=state_mismatch`, { connected: true })).toBe(
      `${SELF}/tools/chat?connected=1`,
    );
  });

  it('marks an error and keeps unrelated params', () => {
    expect(withAuthResult(`${SELF}/tools/chat?site=x&connected=1`, { error: 'exchange_failed' })).toBe(
      `${SELF}/tools/chat?site=x&error=exchange_failed`,
    );
  });
});

describe('allowedReturnOrigins', () => {
  const original = process.env['AUTH_RETURN_ORIGINS'];
  afterEach(() => {
    if (original === undefined) delete process.env['AUTH_RETURN_ORIGINS'];
    else process.env['AUTH_RETURN_ORIGINS'] = original;
  });

  it('is just this origin when unset', () => {
    delete process.env['AUTH_RETURN_ORIGINS'];
    expect(allowedReturnOrigins(SELF)).toEqual([SELF]);
  });

  it('normalises listed entries to origins and drops junk', () => {
    process.env['AUTH_RETURN_ORIGINS'] = ' https://advancelabs.dev/ , not a url,';
    expect(allowedReturnOrigins(SELF)).toEqual([SELF, 'https://advancelabs.dev']);
  });
});
