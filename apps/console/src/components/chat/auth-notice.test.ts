import { describe, expect, it } from 'vitest';
import { authNoticeFrom } from './auth-notice.js';

describe('authNoticeFrom', () => {
  it('is null on a normal visit', () => {
    expect(authNoticeFrom(new URLSearchParams('site=x'))).toBeNull();
  });

  it('reports success', () => {
    expect(authNoticeFrom(new URLSearchParams('connected=1'))?.ok).toBe(true);
  });

  it('explains a known error', () => {
    expect(authNoticeFrom(new URLSearchParams('error=state_mismatch'))).toEqual({
      ok: false,
      text: expect.stringContaining('expired') as unknown as string,
    });
  });

  it('treats server_* as a configuration problem and names unknown codes', () => {
    expect(authNoticeFrom(new URLSearchParams('error=server_GOOGLE_CLIENT_SECRET'))?.text).toMatch(
      /not configured/,
    );
    expect(authNoticeFrom(new URLSearchParams('error=weird'))?.text).toContain('(weird)');
  });
});
