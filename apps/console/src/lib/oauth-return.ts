/**
 * Where the browser lands after the Google OAuth round-trip, and the cookie options that carry the
 * flow across it.
 *
 * Google only hands back `code` + `state`, so the page the user started on has to survive the trip
 * in a short-lived cookie. That value ends up in a `Location` header, which makes it an open-redirect
 * vector: {@link resolveReturnTo} is the single gate every return target passes through, both when the
 * start route writes the cookie and when the callback reads it back. Server-only (reads process.env).
 */

export const RETURN_COOKIE = 'aeo_oauth_return';

/** Where the flow lands when no usable return target was supplied: the GA4 + GSC chat tool. */
export const DEFAULT_RETURN_PATH = '/tools/chat';

export type AuthResult = { connected: true } | { error: string };

/**
 * Options for every OAuth cookie. `AUTH_COOKIE_DOMAIN` (e.g. `.advancelabs.dev`) widens them to all
 * subdomains so a flow started on the marketing site, which proxies `/api/auth/*` here, is readable
 * by this origin's callback, and `/api/connection` proxied from there sees the same session. Unset
 * keeps them host-only, which is right for a self-hosted instance on a single origin.
 */
export function authCookieOptions(maxAge: number): {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: string;
  maxAge: number;
  domain?: string;
} {
  const domain = process.env['AUTH_COOKIE_DOMAIN'];
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
    ...(domain !== undefined && domain.length > 0 ? { domain } : {}),
  };
}

/**
 * Origins the flow may return to: this deployment, plus any listed in `AUTH_RETURN_ORIGINS`
 * (comma-separated), i.e. the sites that proxy `/tools/*` to this app. Entries are normalised to a
 * bare origin; unparseable ones are dropped rather than trusted.
 */
export function allowedReturnOrigins(selfOrigin: string): string[] {
  const extra = (process.env['AUTH_RETURN_ORIGINS'] ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .flatMap((entry) => {
      try {
        return [new URL(entry).origin];
      } catch {
        return [];
      }
    });
  return [selfOrigin, ...extra];
}

/**
 * Turn an untrusted return target (query param or cookie) into an absolute URL that is safe to put
 * in a `Location` header. Anything not provably ours falls back to {@link DEFAULT_RETURN_PATH} on
 * `selfOrigin`.
 *
 * @param raw            untrusted input: null/undefined, a same-site path, an absolute URL, or junk
 * @param allowedOrigins exact origins a return target may point at (from {@link allowedReturnOrigins})
 * @param selfOrigin     this deployment's origin; relative paths resolve against it
 */
export function resolveReturnTo(
  raw: string | null | undefined,
  allowedOrigins: readonly string[],
  selfOrigin: string,
): string {
  const fallback = new URL(DEFAULT_RETURN_PATH, selfOrigin).toString();
  if (raw === null || raw === undefined || raw === '') return fallback;

  let url: URL;
  try {
    url = new URL(raw, selfOrigin);
  } catch {
    return fallback;
  }
  // Exact origin match on the PARSED url, and return that same parsed url, so the check and the
  // redirect can never disagree. This one comparison also rejects `//evil` and `/\evil` (both parse
  // to a foreign host), lookalike suffix domains, a scheme downgrade, and `javascript:` (origin "null").
  return allowedOrigins.includes(url.origin) ? url.toString() : fallback;
}

/** Stamp the flow's outcome onto the return URL, replacing any stale result from an earlier attempt. */
export function withAuthResult(returnTo: string, result: AuthResult): string {
  const url = new URL(returnTo);
  url.searchParams.delete('connected');
  url.searchParams.delete('error');
  if ('error' in result) {
    url.searchParams.set('error', result.error);
  } else {
    url.searchParams.set('connected', '1');
  }
  return url.toString();
}
