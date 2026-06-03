import robotsParser from 'robots-parser';
import type { AiBotDirective, AiBotName, RobotsGroup, RobotsTxt, Url } from '@aeo/types';
import { AI_BOT_NAMES } from './constants.js';

/**
 * The slice of the `robots-parser` instance we rely on. The package ships no first-party types,
 * so we declare the structural contract here at the seam (keeps `any` out of the codebase).
 */
interface RobotsParserLike {
  isAllowed(url: string, userAgent?: string): boolean | undefined;
  getSitemaps(): string[];
  getCrawlDelay(userAgent?: string): number | undefined;
}

/**
 * Parse a raw robots.txt into the toolkit's `RobotsTxt` shape.
 *
 * - `sitemaps[]` is sourced from `Sitemap:` lines via robots-parser.
 * - `aiBotDirectives[]` records, for every known AI crawler, whether it may fetch the site root.
 *   We probe `isAllowed('<origin>/', bot)`; robots-parser returns `undefined` when no rule
 *   matches, which per the standard means *allowed*, so we default missing results to `true`.
 * - `groups[]` is parsed independently from the raw text (robots-parser does not expose its
 *   internal group model), giving callers the user-agent → allow/disallow structure.
 *
 * Pure and synchronous. `url` is the absolute URL the robots.txt was fetched from; it anchors
 * the root probe and is echoed back on the result.
 */
export function parseRobotsTxt(raw: string, url: Url): RobotsTxt {
  const parser = robotsParser(url, raw) as RobotsParserLike;
  const rootUrl = rootForOrigin(url);

  const sitemaps: Url[] = dedupe(safeGetSitemaps(parser));

  const aiBotDirectives: AiBotDirective[] = AI_BOT_NAMES.map(
    (bot: AiBotName): AiBotDirective => ({
      bot,
      // `undefined` (no matching rule) means allowed under the robots.txt standard.
      allowed: parser.isAllowed(rootUrl, bot) !== false,
    }),
  );

  return {
    exists: raw.trim().length > 0,
    url,
    raw,
    sitemaps,
    groups: parseGroups(raw),
    aiBotDirectives,
  };
}

/** A robots.txt result for a site that has none (404 / empty). All bots allowed by default. */
export function emptyRobotsTxt(url: Url): RobotsTxt {
  return {
    exists: false,
    url,
    sitemaps: [],
    groups: [],
    aiBotDirectives: AI_BOT_NAMES.map((bot) => ({ bot, allowed: true })),
  };
}

function safeGetSitemaps(parser: RobotsParserLike): string[] {
  try {
    const sitemaps = parser.getSitemaps();
    return Array.isArray(sitemaps) ? sitemaps : [];
  } catch {
    return [];
  }
}

/**
 * Hand-parse the `User-agent` / `Allow` / `Disallow` / `Crawl-delay` group structure. robots-parser
 * answers per-URL questions but does not expose its grouped rules, so we reconstruct them here for
 * callers (e.g. the scoring engine) that want to inspect directives directly.
 */
function parseGroups(raw: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | undefined;
  // Once we hit a non-user-agent line, the next `User-agent` starts a fresh group.
  let expectingAgents = false;

  for (const line of raw.split(/\r?\n/)) {
    const directive = parseDirective(line);
    if (!directive) continue;
    const { field, value } = directive;

    if (field === 'user-agent') {
      if (!expectingAgents || !current) {
        current = { userAgents: [], allow: [], disallow: [] };
        groups.push(current);
      }
      current.userAgents.push(value);
      expectingAgents = true;
      continue;
    }

    if (!current) {
      // A rule before any User-agent — start an implicit wildcard group.
      current = { userAgents: ['*'], allow: [], disallow: [] };
      groups.push(current);
    }
    expectingAgents = false;

    switch (field) {
      case 'allow':
        if (value) current.allow.push(value);
        break;
      case 'disallow':
        current.disallow.push(value);
        break;
      case 'crawl-delay': {
        const delay = Number.parseFloat(value);
        if (Number.isFinite(delay)) current.crawlDelay = delay;
        break;
      }
      default:
        // Sitemap and unknown directives are not part of a group; ignore here.
        break;
    }
  }

  return groups;
}

/** Split a robots.txt line into `{ field, value }`, stripping comments; `undefined` for blanks. */
function parseDirective(line: string): { field: string; value: string } | undefined {
  const withoutComment = stripComment(line).trim();
  if (withoutComment.length === 0) return undefined;
  const colon = withoutComment.indexOf(':');
  if (colon === -1) return undefined;
  const field = withoutComment.slice(0, colon).trim().toLowerCase();
  const value = withoutComment.slice(colon + 1).trim();
  if (field.length === 0) return undefined;
  return { field, value };
}

/** Remove a trailing `# comment`, leaving any `#` that is inside quoted/escaped content alone. */
function stripComment(line: string): string {
  const hash = line.indexOf('#');
  return hash === -1 ? line : line.slice(0, hash);
}

/** Build the `<origin>/` URL used to probe whether a bot may crawl the root. */
function rootForOrigin(url: Url): string {
  try {
    return new URL(url).origin + '/';
  } catch {
    return '/';
  }
}

function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}
