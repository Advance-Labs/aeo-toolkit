import { describe, expect, it } from 'vitest';
import { runRules } from './engine.js';
import { technicalSeoRules } from './technical-seo-rules.js';
import { aeoRules } from './aeo-rules.js';
import { emptyContext, goodContext, poorContext, singlePageContext } from './fixtures.js';

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
