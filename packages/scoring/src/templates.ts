/**
 * `generateTemplates` — emit ready-to-use crawl-hint files for anything the
 * site is missing (per `ctx.crawl.filePresence`).
 *
 * We only generate a template when the corresponding file is ABSENT, so the
 * audit UI can offer a one-click "you're missing this, here's a starter" file.
 * Output is deterministic given the same context, which keeps tests stable.
 */
import type { GeneratedTemplate, ScoringContext, Url } from '@aeo/types';

/** Best-effort extraction of the bare host (no scheme/path) from a URL. */
function hostOf(url: Url): string {
  try {
    return new URL(url).host;
  } catch {
    // Fall back to a naive strip when the URL is malformed.
    return url.replace(/^https?:\/\//i, '').split('/')[0] ?? url;
  }
}

/** Origin (scheme + host) of a URL, trailing slash trimmed. */
function originOf(url: Url): string {
  try {
    return new URL(url).origin;
  } catch {
    return url.replace(/\/+$/, '');
  }
}

function robotsTxtTemplate(ctx: ScoringContext): GeneratedTemplate {
  const origin = originOf(ctx.crawl.rootUrl);
  const content = [
    'User-agent: *',
    'Allow: /',
    '',
    '# AI answer-engine crawlers — allowed so your content can be cited.',
    'User-agent: GPTBot',
    'Allow: /',
    'User-agent: ClaudeBot',
    'Allow: /',
    'User-agent: PerplexityBot',
    'Allow: /',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
  return {
    filename: 'robots.txt',
    contentType: 'text/plain',
    content,
    reason: 'No robots.txt was found at the site root.',
  };
}

function llmsTxtTemplate(ctx: ScoringContext): GeneratedTemplate {
  const host = hostOf(ctx.crawl.rootUrl);
  const origin = originOf(ctx.crawl.rootUrl);
  const content = [
    `# ${host}`,
    '',
    `> A concise description of ${host} for large language models.`,
    '',
    'Replace this summary with one or two sentences describing what this site offers.',
    '',
    '## Docs',
    '',
    `- [Home](${origin}/): The main landing page.`,
    '',
    '## Optional',
    '',
    `- [About](${origin}/about): Background and team information.`,
    '',
  ].join('\n');
  return {
    filename: 'llms.txt',
    contentType: 'text/plain',
    content,
    reason: 'No llms.txt was found — add one so answer engines read curated content.',
  };
}

function sitemapXmlTemplate(ctx: ScoringContext): GeneratedTemplate {
  const origin = originOf(ctx.crawl.rootUrl);
  // Prefer real crawled/sitemap URLs; fall back to the root when none exist.
  const urls = collectUrls(ctx);
  const today = new Date().toISOString().slice(0, 10);
  const entries = urls.length > 0 ? urls : [origin.endsWith('/') ? origin : `${origin}/`];

  const body = entries
    .map(
      (loc) =>
        `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`,
    )
    .join('\n');

  const content = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    body,
    '</urlset>',
    '',
  ].join('\n');

  return {
    filename: 'sitemap.xml',
    contentType: 'application/xml',
    content,
    reason: 'No sitemap.xml was found — generated from discovered URLs.',
  };
}

/** Gather a de-duplicated, capped list of URLs to seed a sitemap. */
function collectUrls(ctx: ScoringContext): Url[] {
  const seen = new Set<Url>();
  const out: Url[] = [];
  const push = (u: Url | undefined): void => {
    if (!u) return;
    if (seen.has(u)) return;
    seen.add(u);
    out.push(u);
  };
  for (const entry of ctx.crawl.sitemap) push(entry.loc);
  for (const page of ctx.crawl.pages) {
    if (page.ok && page.status >= 200 && page.status < 300) push(page.finalUrl || page.url);
  }
  for (const page of ctx.pages) push(page.url);
  return out.slice(0, 50);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Produce ready-to-use robots.txt / llms.txt / sitemap.xml ONLY for the files
 * the crawl reports as missing. Returns an empty array when nothing is missing.
 */
export function generateTemplates(ctx: ScoringContext): GeneratedTemplate[] {
  const presence = ctx.crawl.filePresence;
  const out: GeneratedTemplate[] = [];
  if (!presence.robotsTxt) out.push(robotsTxtTemplate(ctx));
  if (!presence.llmsTxt) out.push(llmsTxtTemplate(ctx));
  if (!presence.sitemapXml && ctx.crawl.sitemap.length === 0) out.push(sitemapXmlTemplate(ctx));
  return out;
}
