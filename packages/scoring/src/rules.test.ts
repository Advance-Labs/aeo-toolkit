import { describe, expect, it } from 'vitest';
import { runRules } from './engine.js';
import { technicalSeoRules } from './technical-seo-rules.js';
import { aeoRules } from './aeo-rules.js';
import { eeatSignalDefs } from './eeat-rules.js';
import { emptyContext, goodContext, poorContext, singlePageContext } from './fixtures.js';

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
    expect(technicalSeoRules.length).toBe(29);
    expect(aeoRules.length).toBe(11);
    expect(eeatSignalDefs.length).toBe(14);
    expect(technicalSeoRules.length + aeoRules.length + eeatSignalDefs.length).toBe(54);
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
});
