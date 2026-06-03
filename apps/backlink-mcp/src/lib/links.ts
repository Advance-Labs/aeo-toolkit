/**
 * Pure link-verification over fetched page HTML.
 *
 * Given a page's HTML and a target domain, find every anchor whose host matches
 * (or is a subdomain of) the target, and report the link's href, anchor text, and
 * SEO-relevant rel attributes (nofollow / sponsored / ugc) plus whether it opens
 * in a new tab. Pure and synchronous — the network fetch happens in the tool
 * handler via `@aeo/crawler`.
 */
import * as cheerio from 'cheerio';

export interface FoundLink {
  href: string;
  anchorText: string;
  rel: string[];
  nofollow: boolean;
  sponsored: boolean;
  ugc: boolean;
  /** Whether the link is "dofollow" for SEO equity (no nofollow/sponsored/ugc). */
  dofollow: boolean;
  newTab: boolean;
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

function relTokens(rel: string | undefined): string[] {
  if (!rel) return [];
  return rel
    .split(/\s+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
}

/**
 * Verify presence of links to `targetDomain` in the given HTML.
 * `baseUrl` resolves relative/protocol-relative hrefs to absolute URLs.
 */
export function verifyLinks(html: string, baseUrl: string, targetDomain: string): VerifyOutcome {
  const $ = cheerio.load(html);
  const domain = normalizeDomain(targetDomain);
  const matches: FoundLink[] = [];
  let total = 0;

  $('a[href]').each((_i, el) => {
    const rawHref = $(el).attr('href');
    if (!rawHref) return;
    total += 1;

    let abs: URL;
    try {
      abs = new URL(rawHref, baseUrl);
    } catch {
      return;
    }
    if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return;
    if (!hostMatchesDomain(abs.hostname, domain)) return;

    const rel = relTokens($(el).attr('rel'));
    const nofollow = rel.includes('nofollow');
    const sponsored = rel.includes('sponsored');
    const ugc = rel.includes('ugc');
    matches.push({
      href: abs.toString(),
      anchorText: $(el).text().trim(),
      rel,
      nofollow,
      sponsored,
      ugc,
      dofollow: !(nofollow || sponsored || ugc),
      newTab: ($(el).attr('target') ?? '').toLowerCase() === '_blank',
    });
  });

  return {
    targetDomain: domain,
    linkFound: matches.length > 0,
    dofollowFound: matches.some((m) => m.dofollow),
    matches,
    totalLinksOnPage: total,
  };
}
