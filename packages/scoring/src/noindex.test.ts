import { describe, expect, it } from 'vitest';
import type { Finding, ParsedHtml, ScoringContext } from '@advance-labs/types';
import { runRules } from './engine.js';
import { buildAuditReport, auditRules } from './audit.js';
import { goodContext } from './fixtures.js';
import { isNoindex, isNoindexHeader } from './context-utils.js';

const LOGIN = 'https://good.example.com/login';

async function findings(ctx: ScoringContext): Promise<Map<string, Finding>> {
  const { categories } = await runRules(ctx, auditRules);
  return new Map(categories.flatMap((c) => c.findings).map((f) => [f.id, f]));
}

/** goodContext plus a /login page that opts out of indexing and would fail most per-page rules. */
function withLogin(opts: { meta?: string; header?: string; inSitemap?: boolean; sitemap?: boolean } = {}): ScoringContext {
  const base = goodContext();
  const proto = base.pages[1] as ParsedHtml;
  const login: ParsedHtml = {
    ...proto,
    url: LOGIN,
    meta: {
      ...proto.meta,
      title: 'Sign in',
      titleLength: 7,
      description: undefined,
      descriptionLength: 0,
      canonical: undefined,
      robots: opts.meta ?? (opts.header ? undefined : 'noindex, nofollow'),
    },
    content: { ...proto.content, wordCount: 12 },
  };
  return {
    ...base,
    crawl: {
      ...base.crawl,
      pages: [
        ...base.crawl.pages,
        {
          url: LOGIN,
          finalUrl: LOGIN,
          status: 200,
          ok: true,
          headers: opts.header ? { 'x-robots-tag': opts.header } : {},
          timingMs: 100,
          redirectChain: [],
          depth: 1,
        },
      ],
      pageCount: base.crawl.pageCount + 1,
      sitemap: opts.sitemap === false ? [] : opts.inSitemap ? [...base.crawl.sitemap, { loc: LOGIN }] : base.crawl.sitemap,
    },
    pages: [...base.pages, login],
  };
}

describe('noindex pages are excluded from per-page scoring', () => {
  it('does not score a noindex page on title, description, thin-content or heading rules', async () => {
    const baseline = await findings(goodContext());
    const f = await findings(withLogin());
    for (const id of ['tech.meta-title-length', 'tech.meta-description-present', 'tech.content-not-thin', 'tech.unique-titles']) {
      expect(f.get(id)?.passed, id).toBe(baseline.get(id)?.passed);
      expect(f.get(id)?.affectedUrls ?? []).not.toContain(LOGIN);
    }
  });

  it('applies to X-Robots-Tag noindex too', async () => {
    const f = await findings(withLogin({ header: 'noindex' }));
    expect(f.get('tech.meta-title-length')?.passed).toBe(true);
    expect(f.get('tech.meta-description-present')?.passed).toBe(true);
  });

  it('still records the page as crawled and lists it as excluded', async () => {
    const ctx = withLogin();
    const report = await buildAuditReport(ctx, { durationMs: 1, version: 't' });
    expect(report.pagesCrawled).toBe(ctx.crawl.pageCount);
    expect(report.excludedPages).toEqual([{ url: LOGIN, reason: 'noindex' }]);
    expect((await buildAuditReport(goodContext(), { durationMs: 1, version: 't' })).excludedPages).toBeUndefined();
  });

  it('scores everything when every page is noindex (nothing left to exclude into)', async () => {
    const ctx = goodContext();
    ctx.pages = ctx.pages.map((p) => ({ ...p, meta: { ...p.meta, robots: 'noindex' } }));
    const report = await buildAuditReport(ctx, { durationMs: 1, version: 't' });
    expect(report.excludedPages).toBeUndefined();
  });
});

describe('indexability rules still see noindex pages', () => {
  it('tech.indexable ignores a noindex page the sitemap leaves out (deliberate opt-out)', async () => {
    expect((await findings(withLogin())).get('tech.indexable')?.passed).toBe(true);
  });

  it('tech.indexable flags a noindex page the sitemap lists (contradiction)', async () => {
    const f = (await findings(withLogin({ inSitemap: true }))).get('tech.indexable');
    expect(f?.passed).toBe(false);
    expect(f?.affectedUrls).toEqual([LOGIN]);
  });

  it('tech.indexable flags noindex when there is no sitemap to show intent', async () => {
    const f = (await findings(withLogin({ sitemap: false }))).get('tech.indexable');
    expect(f?.passed).toBe(false);
    expect(f?.affectedUrls).toEqual([LOGIN]);
  });

  it('tech.indexable always flags a noindex homepage', async () => {
    const ctx = goodContext();
    ctx.pages = ctx.pages.map((p, i) => (i === 0 ? { ...p, meta: { ...p.meta, robots: 'noindex' } } : p));
    ctx.crawl.sitemap = ctx.crawl.sitemap.filter((e) => e.loc !== ctx.crawl.rootUrl);
    expect((await findings(ctx)).get('tech.indexable')?.passed).toBe(false);
  });

  it('tech.indexable flags an X-Robots-Tag noindex page the sitemap lists', async () => {
    const f = (await findings(withLogin({ header: 'noindex', inSitemap: true }))).get('tech.indexable');
    expect(f?.passed).toBe(false);
  });

  it('canonical-present does not ask a noindex page for a canonical', async () => {
    const f = (await findings(withLogin())).get('tech.canonical-present');
    expect(f?.affectedUrls ?? []).not.toContain(LOGIN);
  });

  it('canonical-resolves still inspects noindex pages (a malformed canonical is flagged)', async () => {
    const ctx = withLogin();
    ctx.pages = ctx.pages.map((p) => (p.url === LOGIN ? { ...p, meta: { ...p.meta, canonical: 'not a url' } } : p));
    const f = (await findings(ctx)).get('tech.canonical-resolves');
    expect(f?.passed).toBe(false);
    expect(f?.affectedUrls).toContain(LOGIN);
  });
});

describe('robots directive parsing', () => {
  const page = (robots?: string): ParsedHtml => ({ meta: { robots } }) as unknown as ParsedHtml;
  it('reads noindex, none and ignores nofollow-only', () => {
    expect(isNoindex(page('noindex, nofollow'))).toBe(true);
    expect(isNoindex(page('none'))).toBe(true);
    expect(isNoindex(page('index, nofollow'))).toBe(false);
    expect(isNoindex(page(undefined))).toBe(false);
  });
  it('reads X-Robots-Tag, honouring search-engine agent prefixes only', () => {
    expect(isNoindexHeader({ 'x-robots-tag': 'noindex' })).toBe(true);
    expect(isNoindexHeader({ 'x-robots-tag': 'googlebot: noindex' })).toBe(true);
    expect(isNoindexHeader({ 'x-robots-tag': 'otherbot: noindex' })).toBe(false);
    expect(isNoindexHeader({})).toBe(false);
  });
});
