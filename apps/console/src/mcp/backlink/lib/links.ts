/**
 * Pure link-verification over fetched page HTML.
 *
 * Given a page's HTML and a target domain, find every anchor whose host matches
 * (or is a subdomain of) the target, and report the link's href, anchor text, and
 * SEO-relevant rel attributes (nofollow / sponsored / ugc) plus whether the link
 * passes link equity (dofollow). Pure and synchronous — the network fetch happens
 * in the tool handler via the injected HTTP client.
 *
 * Re-homed into the console: the standalone app parsed the DOM with `cheerio`
 * directly, but the console shell does not declare `cheerio` as a dependency, so
 * this uses `@aeo/html-parser#extractLinks` (which owns the cheerio parse) instead.
 * The extractor yields resolved absolute hrefs + `rel` tokens, which is everything
 * link verification needs.
 */
import { extractLinks } from '@aeo/html-parser';

export interface FoundLink {
  href: string;
  anchorText: string;
  rel: string[];
  nofollow: boolean;
  sponsored: boolean;
  ugc: boolean;
  /** Whether the link is "dofollow" for SEO equity (no nofollow/sponsored/ugc). */
  dofollow: boolean;
}

export interface VerifyOutcome {
  targetDomain: string;
  linkFound: boolean;
  /** True when at least one matching link passes SEO link equity (dofollow). */
  dofollowFound: boolean;
  matches: FoundLink[];
  totalLinksOnPage: number;
}

/** Normalise a domain string: strip scheme, path, port, leading `www.`, lowercase. */
export function normalizeDomain(input: string): string {
  let host = input.trim().toLowerCase();
  try {
    // If a full URL was passed, parse the hostname out of it.
    if (host.includes('://')) host = new URL(host).hostname;
  } catch {
    // fall through to manual stripping
  }
  host = host
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');
  return host.replace(/^www\./, '');
}

/** True when `host` equals `domain` or is a subdomain of it. */
export function hostMatchesDomain(host: string, domain: string): boolean {
  const h = normalizeDomain(host);
  const d = normalizeDomain(domain);
  if (d === '') return false;
  return h === d || h.endsWith(`.${d}`);
}

/** Split a `rel` string into lowercased, de-whitespaced tokens. */
function relTokens(rel: string | undefined): string[] {
  if (!rel) return [];
  return rel
    .split(/\s+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
}

/** Parse the hostname from an absolute URL, returning '' when it is not parseable. */
function hostOf(href: string): string {
  try {
    const u = new URL(href);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.hostname;
  } catch {
    return '';
  }
}

/**
 * Verify presence of links to `targetDomain` in the given HTML.
 * `baseUrl` resolves relative/protocol-relative hrefs to absolute URLs.
 */
export function verifyLinks(html: string, baseUrl: string, targetDomain: string): VerifyOutcome {
  const domain = normalizeDomain(targetDomain);
  const links = extractLinks(html, baseUrl);
  const matches: FoundLink[] = [];

  for (const link of links) {
    const host = hostOf(link.href);
    if (host === '' || !hostMatchesDomain(host, domain)) continue;

    const rel = relTokens(link.rel);
    const nofollow = rel.includes('nofollow') || link.nofollow;
    const sponsored = rel.includes('sponsored');
    const ugc = rel.includes('ugc');
    matches.push({
      href: link.href,
      anchorText: link.text,
      rel,
      nofollow,
      sponsored,
      ugc,
      dofollow: !(nofollow || sponsored || ugc),
    });
  }

  return {
    targetDomain: domain,
    linkFound: matches.length > 0,
    dofollowFound: matches.some((m) => m.dofollow),
    matches,
    totalLinksOnPage: links.length,
  };
}
