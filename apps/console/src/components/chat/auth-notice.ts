/**
 * Human-readable outcome of the Google OAuth round-trip, read from the `?connected=1` / `?error=…`
 * params the callback stamps onto the return URL. Client-safe (no server imports).
 */

export interface AuthNotice {
  ok: boolean;
  text: string;
}

const ERROR_TEXT: Record<string, string> = {
  access_denied: 'Google sign-in was cancelled.',
  state_mismatch:
    'The sign-in session expired or your browser blocked its cookie. Try connecting again.',
  no_session:
    'The sign-in session expired or your browser blocked its cookie. Try connecting again.',
  missing_code: 'Google did not return a sign-in code. Try connecting again.',
  exchange_failed: 'Google accepted the sign-in, but we could not finish connecting. Try again.',
  google_not_configured: 'Google sign-in is not configured on this deployment.',
};

/** Map the callback's query params to a notice, or `null` when the page was not reached from it. */
export function authNoticeFrom(params: URLSearchParams): AuthNotice | null {
  const error = params.get('error');
  if (error !== null) {
    const text =
      ERROR_TEXT[error] ??
      (error.startsWith('server_')
        ? 'Google sign-in is not configured on this deployment.'
        : `Google sign-in failed (${error}).`);
    return { ok: false, text };
  }
  if (params.get('connected') === '1') {
    return { ok: true, text: 'Google connected. Pick a site and property below.' };
  }
  return null;
}
