/**
 * Regression checks for the scoring bugs found while writing the agent skills (2026-11-14):
 * each case passed or failed for the wrong reason before the fix.
 */
import { describe, expect, it } from 'vitest';
import type { RuleOutcome, ScoringContext, StructuredDataReport } from '@advance-labs/types';
import { aeoRules } from './aeo-rules.js';
import { technicalSeoRules } from './technical-seo-rules.js';
import { eeatScore } from './eeat-rules.js';
import { generateTemplates } from './templates.js';
import { goodContext } from './fixtures.js';

const rule = (id: string) => [...aeoRules, ...technicalSeoRules].find((r) => r.id === id)!;
const run = (id: string, ctx: ScoringContext) => rule(id).evaluate(ctx) as RuleOutcome;

function report(overrides: Partial<StructuredDataReport>): StructuredDataReport {
  return {
    items: [],
    typesPresent: [],
    aeoTypesPresent: [],
    hasOrganization: false,
    hasPerson: false,
    hasArticle: false,
    hasBreadcrumb: false,
    hasFaqOrQa: false,
    totalItems: 0,
    invalidCount: 0,
    ...overrides,
  };
}

/** goodContext with one structured-data report per page, in page order. */
function perPage(reports: Array<Partial<StructuredDataReport>>): ScoringContext {
  const ctx = goodContext();
  ctx.structuredData = ctx.pages.map((_, i) => report(reports[i] ?? {}));
  return ctx;
}

describe('scoring fixes', () => {
  it('entity identity compares Organization subtypes too', () => {
    const ctx = goodContext();
    const org = (type: string, id: string) => ({
      format: 'json-ld' as const,
      type,
      properties: { '@id': id },
      valid: true,
      missingRequired: [],
      warnings: [],
    });
    ctx.structuredData = [
      report({
        items: [
          org('Corporation', 'https://good.example.com/#org'),
          org('Organization,NGO', 'https://good.example.com/#organization'),
        ],
      }),
    ];
    expect(run('aeo.entity-identity-consistent', ctx).passed).toBe(false);
  });

  it('article author is checked per page, not site-wide', () => {
    // Article on the blog post, the only Person on /about: no article names an author.
    const split = perPage([{}, { hasPerson: true }, {}, {}, { hasArticle: true }]);
    expect(run('aeo.article-author-schema', split).passed).toBe(false);
    const attributed = perPage([{}, {}, {}, {}, { hasArticle: true, hasPerson: true }]);
    expect(run('aeo.article-author-schema', attributed).passed).toBe(true);
  });

  it('a JSON-LD parse failure is not structured data', () => {
    const ctx = goodContext();
    ctx.structuredData = [
      report({
        items: [{ format: 'json-ld', type: '', properties: {}, valid: false, missingRequired: [], warnings: [] }],
        totalItems: 1,
        invalidCount: 1,
      }),
    ];
    expect(run('tech.structured-data-present', ctx).passed).toBe(false);
  });

  it('blocking only training bots passes; blocking a search bot fails', () => {
    const ctx = goodContext();
    ctx.crawl.robots.aiBotDirectives = [
      { bot: 'GPTBot', allowed: false },
      { bot: 'ClaudeBot', allowed: false },
      { bot: 'Google-Extended', allowed: false },
      { bot: 'OAI-SearchBot', allowed: true },
      { bot: 'PerplexityBot', allowed: true },
    ];
    expect(run('aeo.ai-bots-allowed', ctx).passed).toBe(true);
    ctx.crawl.robots.aiBotDirectives.push({ bot: 'ChatGPT-User', allowed: false });
    expect(run('aeo.ai-bots-allowed', ctx)).toMatchObject({ passed: false, detail: 'Blocked: ChatGPT-User.' });
  });

  it('one question heading on a five-page site is not enough', () => {
    const ctx = goodContext();
    ctx.pages = ctx.pages.map((p, i) => ({
      ...p,
      content: { ...p.content, questionHeadingCount: i === 0 ? 3 : 0 },
    }));
    expect(run('aeo.question-headings', ctx).passed).toBe(false);
  });

  it('one breadcrumb trail across four deep pages is not enough', () => {
    const one = perPage([{}, { hasBreadcrumb: true }, {}, {}, {}]);
    expect(run('aeo.breadcrumbs', one).passed).toBe(false);
    const most = perPage([{}, { hasBreadcrumb: true }, { hasBreadcrumb: true }, {}, { hasBreadcrumb: true }]);
    expect(run('aeo.breadcrumbs', most).passed).toBe(true);
  });

  it('an empty /about fails, and an About page at another URL passes', () => {
    const signal = (ctx: ScoringContext) =>
      eeatScore(ctx)
        .pillars.flatMap((p) => p.signals)
        .find((s) => s.id === 'eeat.expertise.about-page')?.present;

    const empty = goodContext();
    empty.pages = empty.pages.map((p) =>
      p.url.endsWith('/about') ? { ...p, content: { ...p.content, wordCount: 0 } } : p,
    );
    expect(signal(empty)).toBe(false);

    const story = goodContext();
    story.pages = story.pages.map((p) =>
      p.url.endsWith('/about')
        ? { ...p, url: 'https://good.example.com/story', meta: { ...p.meta, title: 'About us | Good Example' } }
        : p,
    );
    story.crawl.pages = story.crawl.pages.filter((p) => !p.url.endsWith('/about'));
    expect(signal(story)).toBe(true);
  });

  it('the generated sitemap does not stamp a fake lastmod', () => {
    const ctx = goodContext();
    ctx.crawl.filePresence = { ...ctx.crawl.filePresence, sitemapXml: false };
    ctx.crawl.sitemap = [];
    const sitemap = generateTemplates(ctx).find((t) => t.filename === 'sitemap.xml');
    expect(sitemap?.content).toContain('<loc>');
    expect(sitemap?.content).not.toContain('<lastmod>');
  });
});
