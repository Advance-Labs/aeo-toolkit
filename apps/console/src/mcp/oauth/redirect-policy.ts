/**
 * Where a dynamically registered client's authorization codes may be sent.
 *
 * Registration is open (RFC 7591): anyone can POST `/register` and get a client id, and the MCP spec
 * expects exactly that. What keeps an open registry from becoming a phishing kit is the redirect URI.
 * An authorization code only ever travels to a registered redirect, so this policy decides whose
 * machines can ever receive one. PKCE stops a code being redeemed by someone who did not start the
 * flow, but an attacker who registers their own server as a redirect IS the party that started it:
 * they send a victim the authorize link, the victim approves on a genuine Google consent screen, and
 * the code lands with the attacker. Nothing else in this server can tell that apart from a real login.
 */

/** Loopback hosts per RFC 8252 §7.3, plus `localhost`, which is what Claude Code actually sends. */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** A plain-http loopback redirect: a native app listening on the user's own machine. */
export function isLoopback(url: URL): boolean {
  return url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname);
}

/**
 * May a client register `uri` as a redirect target? Called once per URI at `/register`; a client
 * with any disallowed URI is refused outright.
 *
 * LOOPBACK ONLY (decided 2026-09-10). A code can then only ever reach the machine the user is
 * sitting at, which covers Claude Code, Cursor and other native clients. Hosted callbacks (e.g.
 * claude.ai's web connectors) are refused until a named allowlist is added here on purpose: every
 * entry on such a list is a party trusted to receive codes for users' Google data.
 */
export function isAllowedRedirectUri(uri: string): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  // RFC 6749 §3.1.2: a redirection endpoint MUST NOT include a fragment.
  return isLoopback(url) && url.hash === '' && url.username === '' && url.password === '';
}

/**
 * Does a redirect URI presented at `/authorize` match one the client registered? Exact match, except
 * that loopback redirects match on any port: RFC 8252 §7.3 requires this, because a native client
 * picks a free port for each login and would otherwise have to re-register every time.
 */
export function redirectUriMatches(registered: string, presented: string): boolean {
  if (registered === presented) return true;
  let a: URL;
  let b: URL;
  try {
    a = new URL(registered);
    b = new URL(presented);
  } catch {
    return false;
  }
  return (
    isLoopback(a) &&
    isLoopback(b) &&
    a.hostname === b.hostname &&
    a.pathname === b.pathname &&
    a.search === b.search &&
    b.hash === ''
  );
}
