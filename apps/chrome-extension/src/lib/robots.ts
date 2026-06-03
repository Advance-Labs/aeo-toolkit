/**
 * Minimal, dependency-free robots.txt parser.
 *
 * In the full toolkit this is `@aeo/crawler`'s job, but the extension has no
 * Node runtime and only ever inspects a single origin, so we parse the raw text
 * into the shared {@link RobotsTxt} shape here. Pure and synchronous — fully
 * unit-testable without any network.
 */
import type { AiBotDirective, AiBotName, RobotsGroup, RobotsTxt, Url } from '@aeo/types';

/** AI / LLM crawler user-agents we report on, mirroring `@aeo/types` `AiBotName`. */
const AI_BOTS: readonly AiBotName[] = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Bytespider',
  'Amazonbot',
  'meta-externalagent',
];

interface ParsedLine {
  field: string;
  value: string;
}

function splitLines(raw: string): ParsedLine[] {
  const out: ParsedLine[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const withoutComment = line.split('#')[0] ?? '';
    const trimmed = withoutComment.trim();
    if (trimmed === '') continue;
    const idx = trimmed.indexOf(':');
    if (idx === -1) continue;
    const field = trimmed.slice(0, idx).trim().toLowerCase();
    const value = trimmed.slice(idx + 1).trim();
    out.push({ field, value });
  }
  return out;
}

/**
 * Parse robots.txt text into the shared {@link RobotsTxt} structure, grouping
 * consecutive `User-agent` lines and resolving sitemap URLs.
 */
export function parseRobotsTxt(raw: string | null, robotsUrl: Url): RobotsTxt {
  if (raw === null) {
    return {
      exists: false,
      url: robotsUrl,
      sitemaps: [],
      groups: [],
      aiBotDirectives: aiDirectivesFor([]),
    };
  }

  const lines = splitLines(raw);
  const groups: RobotsGroup[] = [];
  const sitemaps: Url[] = [];

  let current: RobotsGroup | null = null;
  // A new User-agent line that immediately follows a rule line starts a new
  // group; consecutive User-agent lines extend the same group.
  let lastWasRule = false;

  for (const { field, value } of lines) {
    if (field === 'sitemap') {
      if (value) sitemaps.push(value);
      continue;
    }
    if (field === 'user-agent') {
      if (current === null || lastWasRule) {
        current = { userAgents: [], allow: [], disallow: [] };
        groups.push(current);
      }
      current.userAgents.push(value);
      lastWasRule = false;
      continue;
    }
    if (current === null) {
      // Rule before any user-agent — start an implicit wildcard group.
      current = { userAgents: ['*'], allow: [], disallow: [] };
      groups.push(current);
    }
    if (field === 'allow') {
      current.allow.push(value);
      lastWasRule = true;
    } else if (field === 'disallow') {
      current.disallow.push(value);
      lastWasRule = true;
    } else if (field === 'crawl-delay') {
      const n = Number(value);
      if (Number.isFinite(n)) current.crawlDelay = n;
      lastWasRule = true;
    }
  }

  return {
    exists: true,
    url: robotsUrl,
    raw,
    sitemaps,
    groups,
    aiBotDirectives: aiDirectivesFor(groups),
  };
}

/** Whether a group's user-agent list matches the given bot (case-insensitive, `*` matches all). */
function groupTargets(group: RobotsGroup, bot: string): boolean {
  const lowerBot = bot.toLowerCase();
  return group.userAgents.some((ua) => {
    const lowerUa = ua.toLowerCase();
    return lowerUa === '*' || lowerUa === lowerBot;
  });
}

/**
 * Decide whether a bot is allowed to crawl the site root (`/`).
 * A bot-specific group takes precedence over the `*` group. Within the
 * applicable group, a root-level `Disallow: /` (with no overriding `Allow: /`)
 * means blocked.
 */
function isBotAllowed(groups: RobotsGroup[], bot: AiBotName): boolean {
  const specific = groups.filter((g) =>
    g.userAgents.some((ua) => ua.toLowerCase() === bot.toLowerCase()),
  );
  const applicable = specific.length > 0 ? specific : groups.filter((g) => groupTargets(g, bot));
  if (applicable.length === 0) return true; // no rule → allowed

  let blocked = false;
  for (const group of applicable) {
    const disallowsRoot = group.disallow.some((path) => path.trim() === '/' || path.trim() === '');
    // An empty Disallow ("Disallow:") explicitly allows everything.
    const explicitlyAllowsEverything = group.disallow.some((path) => path.trim() === '');
    const allowsRoot = group.allow.some((path) => path.trim() === '/');
    if (group.disallow.some((path) => path.trim() === '/') && !allowsRoot) blocked = true;
    if (explicitlyAllowsEverything && !disallowsRoot) blocked = false;
  }
  return !blocked;
}

function aiDirectivesFor(groups: RobotsGroup[]): AiBotDirective[] {
  return AI_BOTS.map((bot) => ({ bot, allowed: isBotAllowed(groups, bot) }));
}
