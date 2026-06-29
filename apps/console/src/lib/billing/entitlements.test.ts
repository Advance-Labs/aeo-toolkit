/**
 * Exhaustive tests for the entitlement decision core + the dormant-safe shell.
 *
 * `evaluateEntitlement` is pure, so we cover every (feature × plan × over/under quota) combination
 * directly. `checkEntitlement` is tested only on its dormant path here — in CI no billing env is set,
 * so `BILLING_ENABLED` is `false` and the gate MUST return ok for every feature (the contract's
 * "dormant proof"). The live/enabled path is integration-tested where Supabase + auth are available.
 */
import { describe, expect, it } from 'vitest';

import {
  checkEntitlement,
  evaluateEntitlement,
  type Feature,
} from './entitlements.js';
import { PLANS, type PlanId } from './plans.js';

const PLAN_IDS: readonly PlanId[] = ['free', 'pro', 'agency'];
const METERED_FEATURES: readonly Feature[] = ['audit', 'graph', 'chat'];

function req(): Request {
  return new Request('https://aeo.test/api/audit/technical', { method: 'POST' });
}

describe('evaluateEntitlement — MCP gate', () => {
  it('allows mcp only on plans whose limits include mcpAccess', () => {
    for (const plan of PLAN_IDS) {
      const result = evaluateEntitlement(plan, 0, 'mcp');
      expect(result.allow).toBe(PLANS[plan].limits.mcpAccess);
      if (!result.allow) {
        expect(result.reason).toBe('mcp_not_in_plan');
      }
    }
  });

  it('denies mcp on free (no mcpAccess) regardless of usage count', () => {
    for (const usage of [0, 1, 999]) {
      const result = evaluateEntitlement('free', usage, 'mcp');
      expect(result).toMatchObject({ plan: 'free', allow: false, reason: 'mcp_not_in_plan' });
    }
  });

  it('allows mcp on pro and agency', () => {
    expect(evaluateEntitlement('pro', 0, 'mcp').allow).toBe(true);
    expect(evaluateEntitlement('agency', 0, 'mcp').allow).toBe(true);
  });
});

describe('evaluateEntitlement — metered quota', () => {
  it('allows every metered feature when strictly under the monthly cap', () => {
    for (const plan of PLAN_IDS) {
      const cap = PLANS[plan].limits.auditsPerMonth;
      // Pick an under-cap count (cap-1), or any count when unlimited.
      const under = cap === -1 ? 10_000 : cap - 1;
      for (const feature of METERED_FEATURES) {
        const result = evaluateEntitlement(plan, under, feature);
        expect(result.allow).toBe(true);
        expect(result.reason).toBeUndefined();
      }
    }
  });

  it('denies metered features once usage reaches the cap (capped plans only)', () => {
    for (const plan of PLAN_IDS) {
      const cap = PLANS[plan].limits.auditsPerMonth;
      if (cap === -1) continue; // unlimited plans are tested below
      for (const feature of METERED_FEATURES) {
        const atCap = evaluateEntitlement(plan, cap, feature);
        expect(atCap).toMatchObject({ plan, allow: false, reason: 'quota_exceeded' });
        const overCap = evaluateEntitlement(plan, cap + 50, feature);
        expect(overCap.allow).toBe(false);
        expect(overCap.reason).toBe('quota_exceeded');
      }
    }
  });

  it('treats auditsPerMonth = -1 (agency) as unlimited for every metered feature', () => {
    expect(PLANS.agency.limits.auditsPerMonth).toBe(-1);
    for (const feature of METERED_FEATURES) {
      expect(evaluateEntitlement('agency', 0, feature).allow).toBe(true);
      expect(evaluateEntitlement('agency', 1_000_000, feature).allow).toBe(true);
    }
  });

  it('allows the boundary case exactly one below the cap and denies exactly at the cap', () => {
    // Free: 5/mo. usage 4 → allowed; usage 5 → denied.
    expect(evaluateEntitlement('free', 4, 'audit').allow).toBe(true);
    expect(evaluateEntitlement('free', 5, 'audit').allow).toBe(false);
    // Pro: 200/mo. usage 199 → allowed; usage 200 → denied.
    expect(evaluateEntitlement('pro', 199, 'graph').allow).toBe(true);
    expect(evaluateEntitlement('pro', 200, 'graph').allow).toBe(false);
  });

  it('echoes the userId into the result snapshot without affecting the decision', () => {
    const withUser = evaluateEntitlement('pro', 0, 'audit', 'user-123');
    expect(withUser.userId).toBe('user-123');
    expect(withUser.allow).toBe(true);
    const withoutUser = evaluateEntitlement('pro', 0, 'audit');
    expect(withoutUser.userId).toBeNull();
  });
});

describe('checkEntitlement — dormant-safe (no billing env in CI)', () => {
  it('returns ok with plan=free and userId=null for EVERY self-serve feature when billing is dormant', async () => {
    const features: readonly Feature[] = ['audit', 'mcp', 'graph', 'chat'];
    for (const feature of features) {
      const result = await checkEntitlement(req(), feature);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.plan).toBe('free');
        expect(result.userId).toBeNull();
      }
    }
  });
});

describe('evaluateEntitlement — managed gate', () => {
  it('allows the managed feature only on the managed plan', () => {
    expect(evaluateEntitlement('managed', 0, 'managed').allow).toBe(true);
  });

  it('denies managed on every self-serve plan with reason managed_not_in_plan', () => {
    for (const plan of ['free', 'pro', 'agency'] as const) {
      const decision = evaluateEntitlement(plan, 0, 'managed');
      expect(decision.allow).toBe(false);
      expect(decision.reason).toBe('managed_not_in_plan');
    }
  });
});

describe('checkEntitlement — managed is inert when dormant (NOT open)', () => {
  it('denies the managed feature when managed env is absent, unlike the always-open free tools', async () => {
    const result = await checkEntitlement(req(), 'managed');
    expect(result.ok).toBe(false);
  });
});
