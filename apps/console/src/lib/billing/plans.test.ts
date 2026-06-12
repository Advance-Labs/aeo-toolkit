import { describe, expect, it } from 'vitest';

import { PLANS, PLAN_ORDER, planFor } from './plans.js';

describe('PLANS', () => {
  it('defines exactly the three tiers in order', () => {
    expect(PLAN_ORDER).toEqual(['free', 'pro', 'agency']);
    expect(Object.keys(PLANS).sort()).toEqual(['agency', 'free', 'pro']);
  });

  it('keeps the default prices and limits from the contract', () => {
    expect(PLANS.free.priceUsdMonthly).toBe(0);
    expect(PLANS.free.stripePriceEnv).toBeNull();
    expect(PLANS.free.limits).toEqual({ auditsPerMonth: 5, mcpAccess: false, seats: 1 });

    expect(PLANS.pro.priceUsdMonthly).toBe(29);
    expect(PLANS.pro.stripePriceEnv).toBe('STRIPE_PRICE_PRO');
    expect(PLANS.pro.limits).toEqual({ auditsPerMonth: 200, mcpAccess: true, seats: 1 });

    expect(PLANS.agency.priceUsdMonthly).toBe(99);
    expect(PLANS.agency.stripePriceEnv).toBe('STRIPE_PRICE_AGENCY');
    expect(PLANS.agency.limits).toEqual({ auditsPerMonth: -1, mcpAccess: true, seats: 5 });
  });

  it('each plan id matches its map key', () => {
    for (const [key, plan] of Object.entries(PLANS)) {
      expect(plan.id).toBe(key);
    }
  });
});

describe('planFor', () => {
  it('returns free for null / undefined / inactive statuses', () => {
    expect(planFor(null)).toBe('free');
    expect(planFor(undefined)).toBe('free');
    expect(planFor('canceled', 'pro')).toBe('free');
    expect(planFor('past_due', 'agency')).toBe('free');
    expect(planFor('unpaid', 'pro')).toBe('free');
    expect(planFor('incomplete', 'agency')).toBe('free');
  });

  it('resolves the stored plan for active and trialing subscriptions', () => {
    expect(planFor('active', 'pro')).toBe('pro');
    expect(planFor('active', 'agency')).toBe('agency');
    expect(planFor('trialing', 'agency')).toBe('agency');
    expect(planFor('trialing', 'pro')).toBe('pro');
  });

  it('defaults an active subscription with an unknown/missing plan to pro (lowest paid tier)', () => {
    expect(planFor('active', null)).toBe('pro');
    expect(planFor('active', undefined)).toBe('pro');
    expect(planFor('active', 'enterprise')).toBe('pro');
  });
});
