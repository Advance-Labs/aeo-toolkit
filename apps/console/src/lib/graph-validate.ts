/** Request-body validation for the backlink-graph endpoints. Pure, no I/O. */

export type GraphRequestResult = { ok: true; url: string } | { ok: false; error: string };

/** Prepend `https://` when no scheme is given, so we always have an absolute URL. */
function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === '') return trimmed;
  // Detect ANY scheme (e.g. ftp://) — only prepend https:// when no scheme is present, so a
  // non-http(s) URL stays intact and is rejected by the protocol check rather than corrupted.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Validate and normalize an unknown request body into a fetchable http(s) URL.
 * Returns a discriminated result rather than throwing so the route can map it to
 * a structured 400 cleanly.
 */
export function validateGraphRequest(body: unknown): GraphRequestResult {
  if (typeof body !== 'object' || body === null || !('url' in body)) {
    return { ok: false, error: 'Request body must be a JSON object with a "url" field.' };
  }

  const rawUrl = (body as { url: unknown }).url;
  if (typeof rawUrl !== 'string' || rawUrl.trim() === '') {
    return { ok: false, error: '"url" must be a non-empty string.' };
  }

  const normalized = normalizeUrl(rawUrl);
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return { ok: false, error: 'That does not look like a valid URL.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Only http and https URLs are supported.' };
  }

  return { ok: true, url: parsed.toString() };
}
