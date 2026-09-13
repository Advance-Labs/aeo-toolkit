import { describe, expect, it } from 'vitest';

import { seal, unseal } from './seal.js';
import { issueTokens, readGrant, verifyPkce } from './grants.js';
import { isAllowedRedirectUri, redirectUriMatches } from './redirect-policy.js';

describe('isAllowedRedirectUri (loopback only)', () => {
  it('allows loopback http redirects, as native clients like Claude Code send', () => {
    expect(isAllowedRedirectUri('http://localhost:43111/callback')).toBe(true);
    expect(isAllowedRedirectUri('http://127.0.0.1:8080/cb')).toBe(true);
    expect(isAllowedRedirectUri('http://[::1]:9000/cb')).toBe(true);
  });

  it('refuses anything a code could leave the machine through', () => {
    expect(isAllowedRedirectUri('https://claude.ai/api/mcp/auth_callback')).toBe(false);
    expect(isAllowedRedirectUri('https://localhost/callback')).toBe(false);
    expect(isAllowedRedirectUri('http://localhost.evil.example/cb')).toBe(false);
    expect(isAllowedRedirectUri('http://evil.example@localhost/cb')).toBe(false);
    expect(isAllowedRedirectUri('http://localhost/cb#frag')).toBe(false);
    expect(isAllowedRedirectUri('not a url')).toBe(false);
    expect(isAllowedRedirectUri('javascript:alert(1)')).toBe(false);
  });
});

const SECRET = 'test-secret-one';

describe('seal / unseal', () => {
  it('round-trips a payload and stamps iat', () => {
    const value = seal('access', { sub: 'u1' }, SECRET);
    expect(value.startsWith('aeo_at_')).toBe(true);
    expect(unseal('access', value, SECRET)).toMatchObject({ sub: 'u1', iat: expect.any(Number) });
  });

  it('refuses a value sealed under another secret', () => {
    expect(unseal('access', seal('access', { sub: 'u1' }, SECRET), 'other-secret')).toBeNull();
  });

  it('refuses one kind presented as another, even with the prefix swapped', () => {
    // The prefix is cosmetic; GCM additional data binds the kind, so re-labelling fails the tag.
    const refresh = seal('refresh', { sub: 'u1' }, SECRET);
    expect(unseal('access', refresh, SECRET)).toBeNull();
    expect(unseal('access', refresh.replace('aeo_rt_', 'aeo_at_'), SECRET)).toBeNull();
  });

  it('refuses a tampered body', () => {
    const value = seal('access', { sub: 'u1' }, SECRET);
    const last = value.at(-1) === 'A' ? 'B' : 'A';
    expect(unseal('access', value.slice(0, -1) + last, SECRET)).toBeNull();
  });

  it('expires on exp', () => {
    const t0 = 1_800_000_000_000;
    const value = seal('code', { sub: 'u1' }, SECRET, { ttlSeconds: 60, now: t0 });
    expect(unseal('code', value, SECRET, t0 + 59_000)).not.toBeNull();
    expect(unseal('code', value, SECRET, t0 + 60_000)).toBeNull();
  });

  it('treats junk as null, never a throw', () => {
    for (const junk of [null, undefined, '', 'aeo_at_', 'aeo_at_%%%', 'Bearer x', 'ya29.token']) {
      expect(unseal('access', junk, SECRET)).toBeNull();
    }
  });
});

describe('issueTokens / readGrant', () => {
  it('issues tokens that read back as the same grant, and not as each other', () => {
    const tokens = issueTokens({ sub: 'u1', cid: 'c1' }, SECRET);
    expect(readGrant('access', tokens.access_token, SECRET)).toEqual({ sub: 'u1', cid: 'c1' });
    expect(readGrant('refresh', tokens.refresh_token, SECRET)).toEqual({ sub: 'u1', cid: 'c1' });
    expect(readGrant('access', tokens.refresh_token, SECRET)).toBeNull();
  });
});

describe('verifyPkce', () => {
  // RFC 7636 Appendix B.
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  const challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

  it('accepts the RFC 7636 test vector', () => {
    expect(verifyPkce(verifier, challenge)).toBe(true);
  });

  it('rejects a wrong, missing or malformed verifier', () => {
    expect(verifyPkce(verifier.replace('d', 'e'), challenge)).toBe(false);
    expect(verifyPkce(null, challenge)).toBe(false);
    expect(verifyPkce('short', challenge)).toBe(false);
  });
});

describe('redirectUriMatches', () => {
  it('matches loopback redirects on any port, and nothing else loosely', () => {
    expect(redirectUriMatches('http://localhost:1234/callback', 'http://localhost:5678/callback')).toBe(true);
    expect(redirectUriMatches('http://localhost:1234/callback', 'http://localhost:5678/other')).toBe(false);
    expect(redirectUriMatches('http://localhost/callback', 'http://127.0.0.1/callback')).toBe(false);
    expect(redirectUriMatches('https://app.example/cb', 'https://app.example:444/cb')).toBe(false);
    expect(redirectUriMatches('https://app.example/cb', 'https://app.example/cb')).toBe(true);
  });
});
