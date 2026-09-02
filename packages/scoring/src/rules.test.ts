import { describe, expect, it } from 'vitest';
import type { Finding, HreflangEntry, ScoreCategory, ScoringContext } from '@advance-labs/types';
import { runRules } from './engine.js';
import { technicalSeoRules } from './technical-seo-rules.js';
import { aeoRules } from './aeo-rules.js';
import { eeatSignalDefs } from './eeat-rules.js';
import { emptyContext, goodContext, poorContext, singlePageContext } from './fixtures.js';

/** The finding for one rule id out of a `runRules` result. */
function findingIn(result: { categories: ScoreCategory[] }, id: string): Finding | undefined {
  return result.categories.flatMap((c) => c.findings).find((f) => f.id === id);
}

/** goodContext with the first page carrying the given hreflang annotations. */
function withHreflangs(entries: HreflangEntry[]): ScoringContext {
  const ctx = goodContext();
  ctx.pages = ctx.pages.map((p, i) => (i === 0 ? { ...p, hreflangs: entries } : p));
  return ctx;
}

describe('published rule counts', () => {
  /**
   * These numbers are QUOTED PUBLICLY — advancelabs.dev/services/aeo-audit sells the audit as an
   * "N-rule engine" and breaks it down by family, right next to an invitation to read this
   * MIT-licensed source. On 2026-08-01 that copy claimed 51 rules with a 16-rule E-E-A-T family
   * when the real numbers were 49 and 14; it had been wrong since the copy was written, because
   * nothing connected the claim to the code.
   *
   * So: if this test fails, the rule set changed and the marketing copy is now lying. Update
   * BOTH, then this number. Known places to change (advance-labs repo):
   *   - web/src/app/services/aeo-audit/page.js   (metadata, FAQ answer, ENGINE family cards)
   *   - web/src/app/capabilities/page.js, web/src/app/services/page.js, web/src/app/page.js
   *   - web/src/content/articles/*.js            (several reference the total)
   *
   * Note the two families are structurally different engines: technical + AEO are `Rule[]` run
   * by `runRules`, while E-E-A-T is a separate signal-definition set. The public "N-rule" figure
   * sums both, so both are pinned here.
   */
  it('matches the counts published on the marketing site', () => {
    // 2026-09: +2 technical (tech.charset-declared #10, tech.hreflang-valid #12) and
    // +1 AEO (aeo.content-freshness #11) — 54 became 57; update the marketing pages above.
    expect(technicalSeoRules.length).toBe(31);
    expect(aeoRules.length).toBe(12);
    expect(eeatSignalDefs.length).toBe(14);
    expect(technicalSeoRules.length + aeoRules.length + eeatSignalDefs.length).toBe(57);
  });
});

describe('technicalSeoRules', () => {
  it('ships 20+ rules with unique ids across the expected categories', () => {
    expect(technicalSeoRules.length).toBeGreaterThanOrEqual(20);
    const ids = new Set(technicalSeoRules.map((r) => r.id));
    expect(ids.size).toBe(technicalSeoRules.length);
    const categories = new Set(technicalSeoRules.map((r) => r.category));
    for (const c of [
      'crawlability',
      'indexing',
      'metadata',
      'structured-data',
      'content',
      'mobile',
      'security',
      'social',
    ]) {
      expect(categories.has(c as never)).toBe(true);
    }
  });

  it('passes the good site and fails key rules on the poor site', async () => {
    const good = await runRules(goodContext(), technicalSeoRules);
    const poor = await runRules(poorContext(), technicalSeoRules);
    expect(good.score.overall).toBeGreaterThan(poor.score.overall);

    const poorFindings = poor.categories.flatMap((c) => c.findings);
    expect(poorFindings.find((f) => f.id === 'tech.https')?.passed).toBe(false);
    expect(poorFindings.find((f) => f.id === 'tech.indexable')?.passed).toBe(false);
    expect(poorFindings.find((f) => f.id === 'tech.robots-present')?.passed).toBe(false);
  });

  it('does not penalize title-uniqueness in single-page mode', async () => {
    const { categories } = await runRules(singlePageContext(), technicalSeoRules);
    const unique = categories.flatMap((c) => c.findings).find((f) => f.id === 'tech.unique-titles');
    expect(unique?.passed).toBe(true);
  });

  it('charset: passes when every page declares an encoding, fails naming the gap (#10)', async () => {
    const good = await runRules(goodContext(), technicalSeoRules);
    expect(findingIn(good, 'tech.charset-declared')?.passed).toBe(true);

    const poor = await runRules(poorContext(), technicalSeoRules);
    const finding = findingIn(poor, 'tech.charset-declared');
    expect(finding?.passed).toBe(false);
  });

  describe('tech.hreflang-valid (#12)', () => {
    it('skips cleanly when no hreflang annotations exist', async () => {
      const { categories } = await runRules(goodContext(), technicalSeoRules);
      const finding = categories
        .flatMap((c) => c.findings)
        .find((f) => f.id === 'tech.hreflang-valid');
      expect(finding?.passed).toBe(true);
    });

    it('passes valid annotations pointing at crawled pages', async () => {
      const ctx = withHreflangs([
        { hreflang: 'en', href: 'https://good.example.com/' },
        { hreflang: 'fr-FR', href: 'https://good.example.com/about' },
        { hreflang: 'x-default', href: 'https://good.example.com/' },
        // Cross-domain alternate: this crawl cannot verify it, so it must not fail it.
        { hreflang: 'de', href: 'https://example.de/' },
      ]);
      const result = await runRules(ctx, technicalSeoRules);
      expect(findingIn(result, 'tech.hreflang-valid')?.passed).toBe(true);
    });

    it('fails on an invalid language subtag, naming the offending value', async () => {
      const ctx = withHreflangs([{ hreflang: 'english', href: 'https://good.example.com/' }]);
      const result = await runRules(ctx, technicalSeoRules);
      const finding = findingIn(result, 'tech.hreflang-valid');
      expect(finding?.passed).toBe(false);
      // The detail (appended to description) must quote the value, not just count failures.
      expect(finding?.description).toContain('"english"');
    });

    it('fails on a same-host target the crawl never reached, naming the URL', async () => {
      const ctx = withHreflangs([{ hreflang: 'de', href: 'https://good.example.com/de/' }]);
      const result = await runRules(ctx, technicalSeoRules);
      const finding = findingIn(result, 'tech.hreflang-valid');
      expect(finding?.passed).toBe(false);
      expect(finding?.description).toContain('https://good.example.com/de/');
    });

    it('validates value shape but not reachability in single-page mode', async () => {
      const ctx = singlePageContext();
      ctx.pages = ctx.pages.map((p) => ({
        ...p,
        hreflangs: [{ hreflang: 'de', href: 'https://good.example.com/de/' }],
      }));
      const result = await runRules(ctx, technicalSeoRules);
      expect(findingIn(result, 'tech.hreflang-valid')?.passed).toBe(true);
    });
  });
});

describe('aeoRules', () => {
  it('ships ~10 rules all in the aeo category', () => {
    expect(aeoRules.length).toBeGreaterThanOrEqual(10);
    expect(aeoRules.every((r) => r.category === 'aeo')).toBe(true);
  });

  it('rewards the good site and flags blocked AI bots on the poor site', async () => {
    const good = await runRules(goodContext(), aeoRules);
    const poor = await runRules(poorContext(), aeoRules);
    expect(good.score.overall).toBeGreaterThan(poor.score.overall);

    const botRule = poor.categories
      .flatMap((c) => c.findings)
      .find((f) => f.id === 'aeo.ai-bots-allowed');
    expect(botRule?.passed).toBe(false);
  });

  it('does not throw on an empty context', async () => {
    await expect(
      runRules(emptyContext(), [...technicalSeoRules, ...aeoRules]),
    ).resolves.toBeDefined();
  });

  describe('aeo.content-freshness (#11)', () => {
    it('passes when structured data carries a parseable dateModified', async () => {
      // goodContext ships a dated Article item in its structured-data fixture.
      const result = await runRules(goodContext(), aeoRules);
      expect(findingIn(result, 'aeo.content-freshness')?.passed).toBe(true);
    });

    it('fails with a "no date" detail when nothing is dated', async () => {
      const result = await runRules(poorContext(), aeoRules);
      const finding = findingIn(result, 'aeo.content-freshness');
      expect(finding?.passed).toBe(false);
      // "Add the property" and "fix its format" are different fixes; the detail says which.
      expect(finding?.description).toContain('No dateModified or datePublished');
    });

    it('fails with an "unparseable" detail when a date exists but does not parse', async () => {
      const ctx = goodContext();
      ctx.structuredData = ctx.structuredData.map((report) => ({
        ...report,
        items: [
          {
            format: 'json-ld' as const,
            type: 'Article',
            properties: { dateModified: 'last Tuesday' },
            valid: true,
            missingRequired: [],
            warnings: [],
          },
        ],
      }));
      const result = await runRules(ctx, aeoRules);
      const finding = findingIn(result, 'aeo.content-freshness');
      expect(finding?.passed).toBe(false);
      expect(finding?.description).toContain('unparseable');
      expect(finding?.description).toContain('last Tuesday');
    });
  });
});
