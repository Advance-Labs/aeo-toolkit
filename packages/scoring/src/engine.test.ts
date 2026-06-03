import { describe, expect, it } from 'vitest';
import type { Rule, ScoringContext } from '@aeo/types';
import { aggregateScore, runRules } from './engine.js';
import { emptyContext, goodContext } from './fixtures.js';

const passRule: Rule = {
  id: 'test.pass',
  category: 'content',
  severity: 'low',
  weight: 4,
  title: 'always passes',
  description: 'd',
  recommendation: 'r',
  evaluate: () => ({ passed: true }),
};

const failRule: Rule = {
  id: 'test.fail',
  category: 'content',
  severity: 'critical',
  weight: 6,
  title: 'always fails',
  description: 'd',
  recommendation: 'r',
  evaluate: () => ({ passed: false, detail: 'because reasons' }),
};

const asyncRule: Rule = {
  id: 'test.async',
  category: 'security',
  severity: 'high',
  weight: 2,
  title: 'async pass',
  description: 'd',
  recommendation: 'r',
  evaluate: async () => Promise.resolve({ passed: true }),
};

const throwingRule: Rule = {
  id: 'test.throw',
  category: 'security',
  severity: 'high',
  weight: 2,
  title: 'throws',
  description: 'd',
  recommendation: 'r',
  evaluate: () => {
    throw new Error('boom');
  },
};

describe('runRules', () => {
  it('aggregates weighted pass ratio per category and overall', async () => {
    const ctx = goodContext();
    const { categories, score } = await runRules(ctx, [passRule, failRule]);

    const content = categories.find((c) => c.key === 'content');
    expect(content).toBeDefined();
    // pass weight 4 of total weight 10 -> 40
    expect(content?.score).toBe(40);
    expect(content?.passedCount).toBe(1);
    expect(content?.failedCount).toBe(1);

    // single category -> overall equals its score
    expect(score.overall).toBe(40);
    expect(score.grade).toBe('F');
    expect(score.criticalCount).toBe(1);
  });

  it('runs async rules and folds a thrown rule into a failed finding', async () => {
    const ctx = goodContext();
    const { categories, score } = await runRules(ctx, [asyncRule, throwingRule]);
    const security = categories.find((c) => c.key === 'security');
    expect(security?.passedCount).toBe(1);
    expect(security?.failedCount).toBe(1);
    const thrown = security?.findings.find((f) => f.id === 'test.throw');
    expect(thrown?.passed).toBe(false);
    expect(thrown?.description).toContain('evaluation error');
    // does not throw, score is well-defined
    expect(score.overall).toBeGreaterThanOrEqual(0);
  });

  it('treats a category with no weighted rules as a perfect 100', async () => {
    const zeroWeight: Rule = { ...passRule, id: 'test.zero', weight: 0 };
    const { categories } = await runRules(goodContext(), [zeroWeight]);
    expect(categories[0]?.score).toBe(100);
  });

  it('does not throw on an empty context', async () => {
    const ctx: ScoringContext = emptyContext();
    await expect(runRules(ctx, [passRule, failRule])).resolves.toBeDefined();
  });
});

describe('aggregateScore', () => {
  it('returns 100 for no categories', () => {
    const score = aggregateScore([]);
    expect(score.overall).toBe(100);
    expect(score.grade).toBe('A');
  });
});
