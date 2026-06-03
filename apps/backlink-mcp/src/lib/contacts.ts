/**
 * Pure contact-info extraction from raw page HTML.
 *
 * Emails are matched by regex (including `mailto:` links) and de-obfuscated for
 * the common `name [at] domain [dot] com` pattern. Social handles are pulled from
 * profile links on the major networks. Everything here is pure and synchronous so
 * it unit-tests against fixed HTML strings with no network.
 */
import * as cheerio from 'cheerio';

export type SocialNetwork =
  | 'twitter'
  | 'linkedin'
  | 'facebook'
  | 'instagram'
  | 'github'
  | 'youtube'
  | 'mastodon';

export interface SocialHandle {
  network: SocialNetwork;
  handle: string;
  url: string;
}

export interface ContactInfo {
  emails: string[];
  socials: SocialHandle[];
}

// Pragmatic email regex: local@domain.tld. Not RFC-complete by design — it favours
// precision over recall to avoid scraping junk like version strings.
const EMAIL_RE =
  /[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}/gi;

// "name [at] domain [dot] com" style obfuscation.
const OBFUSCATED_RE =
  /([a-z0-9._%+-]+)\s*(?:\[at\]|\(at\)|\s+at\s+)\s*([a-z0-9.-]+)\s*(?:\[dot\]|\(dot\)|\s+dot\s+)\s*([a-z]{2,})/gi;

/** Hosts we never want to surface as contact emails (assets, examples, sentinels). */
const EMAIL_HOST_DENYLIST = new Set([
  'example.com',
  'example.org',
  'sentry.io',
  'wixpress.com',
  'schema.org',
  'w3.org',
]);

/** File extensions that indicate the "address" is actually an asset path. */
const ASSET_TLD_DENYLIST = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'css',
  'js',
  'ico',
]);

function emailLooksReal(email: string): boolean {
  const at = email.lastIndexOf('@');
  if (at < 0) return false;
  const host = email.slice(at + 1).toLowerCase();
  if (EMAIL_HOST_DENYLIST.has(host)) return false;
  const tld = host.slice(host.lastIndexOf('.') + 1);
  if (ASSET_TLD_DENYLIST.has(tld)) return false;
  return true;
}

/** Extract and normalise unique emails from raw text/HTML. */
export function extractEmails(text: string): string[] {
  const found = new Set<string>();

  for (const match of text.matchAll(EMAIL_RE)) {
    const email = match[0].toLowerCase();
    if (emailLooksReal(email)) found.add(email);
  }

  for (const match of text.matchAll(OBFUSCATED_RE)) {
    const [, local, domain, tld] = match;
    if (local && domain && tld) {
      const email = `${local}@${domain}.${tld}`.toLowerCase();
      if (emailLooksReal(email)) found.add(email);
    }
  }

  return [...found];
}

interface SocialMatcher {
  network: SocialNetwork;
  hosts: string[];
  /** Pull the handle from the first path segment unless overridden. */
  extract?: (path: string) => string | undefined;
}

const SOCIAL_MATCHERS: SocialMatcher[] = [
  { network: 'twitter', hosts: ['twitter.com', 'x.com'] },
  { network: 'linkedin', hosts: ['linkedin.com', 'www.linkedin.com'] },
  { network: 'facebook', hosts: ['facebook.com', 'www.facebook.com'] },
  { network: 'instagram', hosts: ['instagram.com', 'www.instagram.com'] },
  { network: 'github', hosts: ['github.com', 'www.github.com'] },
  { network: 'youtube', hosts: ['youtube.com', 'www.youtube.com'] },
];

/** Path segments that are network chrome, not user handles. */
const NON_HANDLE_SEGMENTS = new Set([
  'share',
  'sharer',
  'sharer.php',
  'intent',
  'home',
  'login',
  'signup',
  'about',
  'watch',
  'feed',
  'company',
  'pulse',
  '',
]);

function handleFromUrl(href: string, baseUrl: string): SocialHandle | undefined {
  let u: URL;
  try {
    u = new URL(href, baseUrl);
  } catch {
    return undefined;
  }
  const host = u.hostname.toLowerCase();
  for (const matcher of SOCIAL_MATCHERS) {
    if (!matcher.hosts.includes(host)) continue;
    const segments = u.pathname.split('/').filter((s) => s.length > 0);
    const first = segments[0]?.toLowerCase();
    if (first === undefined || NON_HANDLE_SEGMENTS.has(first)) return undefined;
    const handle =
      matcher.network === 'linkedin' && segments[0] ? (segments[1] ?? segments[0]) : segments[0];
    if (handle === undefined) return undefined;
    return {
      network: matcher.network,
      handle: handle.replace(/^@/, ''),
      url: u.toString(),
    };
  }
  return undefined;
}

/** Extract unique social handles from anchor hrefs in the HTML. */
export function extractSocials(html: string, baseUrl: string): SocialHandle[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const out: SocialHandle[] = [];

  $('a[href]').each((_i, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const handle = handleFromUrl(href, baseUrl);
    if (!handle) return;
    const key = `${handle.network}:${handle.handle.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(handle);
  });

  return out;
}

/** Full contact extraction: emails (from text) + socials (from anchors). */
export function extractContacts(html: string, baseUrl: string): ContactInfo {
  return {
    emails: extractEmails(html),
    socials: extractSocials(html, baseUrl),
  };
}
