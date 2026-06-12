/**
 * Pricing model — the single, configurable source of truth for the commercial layer.
 *
 * This file is **meant to be edited**: the prices, limits, and feature copy below are starting
 * points the operator tunes. The gating layer (`lib/billing/entitlements.ts`) and the pricing page
 * (`app/pricing/page.tsx`) both import {@link PLANS} and {@link planFor} — keep the exported types
 * stable so those callers stay bound.
 *
 * Dormant-safe: this module reads no environment and has no side effects, so it is always importable.
 * The Stripe price *ids* are not hard-coded here — each paid plan names the env var
 * ({@link Plan.stripePriceEnv}) that holds its live price id, so the same code ships dormant and
 * lights up only when those vars are set (see `lib/billing/stripe.ts`).
 */

/** The three subscription tiers. `free` is the default for unauthenticated / unsubscribed users. */
export type PlanId = 'free' | 'pro' | 'agency';

/**
 * A single pricing tier. Limits use `-1` to mean "unlimited" (checked explicitly by the gating layer
 * before comparing usage counts).
 */
export interface Plan {
  /** Stable plan identifier; also the value persisted to `subscriptions.plan`. */
  id: PlanId;
  /** Human-facing plan name, e.g. `"Pro"`. */
  name: string;
  /** Display price in whole US dollars per month. `0` for the free tier. */
  priceUsdMonthly: number;
  /**
   * Name of the environment variable holding this plan's Stripe Price id (e.g. `STRIPE_PRICE_PRO`),
   * or `null` for tiers with no Stripe price (the free tier). Resolved **server-side only** — the
   * client never supplies a price id, eliminating price tampering.
   */
  stripePriceEnv: string | null;
  /** Hard entitlement limits enforced by the gating layer. `-1` denotes unlimited. */
  limits: {
    /** Audits allowed per calendar month. `-1` = unlimited. */
    auditsPerMonth: number;
    /** Whether the plan may call the MCP endpoints. */
    mcpAccess: boolean;
    /** Number of seats included. `-1` = unlimited. */
    seats: number;
  };
  /** One-line marketing blurb for the pricing card. */
  blurb: string;
  /** Bullet-point feature list for the pricing card. */
  features: string[];
}

/**
 * Default tiers — EDITABLE. Tune prices, limits, and copy here; downstream code reads only the
 * shape, never specific numbers. When you change a paid price you must also update the matching
 * Stripe Price and the env var named in {@link Plan.stripePriceEnv}.
 *
 * Defaults:
 *  - **Free**   $0/mo  — 5 audits/mo, no MCP, 1 seat.
 *  - **Pro**    $29/mo — 200 audits/mo, MCP access, 1 seat.
 *  - **Agency** $99/mo — unlimited audits, MCP, 5 seats.
 */
export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    priceUsdMonthly: 0,
    stripePriceEnv: null,
    limits: { auditsPerMonth: 5, mcpAccess: false, seats: 1 },
    blurb: 'Kick the tires on every tool, no card required.',
    features: [
      '5 site audits per month',
      'Full AEO + E-E-A-T scoring',
      'Content generator & knowledge graph',
      '1 seat',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceUsdMonthly: 29,
    stripePriceEnv: 'STRIPE_PRICE_PRO',
    limits: { auditsPerMonth: 200, mcpAccess: true, seats: 1 },
    blurb: 'For operators shipping AEO work every week.',
    features: [
      '200 site audits per month',
      'MCP access (Claude, Cursor & more)',
      'Everything in Free',
      '1 seat',
    ],
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    priceUsdMonthly: 99,
    stripePriceEnv: 'STRIPE_PRICE_AGENCY',
    limits: { auditsPerMonth: -1, mcpAccess: true, seats: 5 },
    blurb: 'Unlimited audits and MCP for the whole team.',
    features: [
      'Unlimited site audits',
      'MCP access (Claude, Cursor & more)',
      'Everything in Pro',
      '5 seats',
    ],
  },
};

/** Ordered list of plans (free → agency) for rendering pricing cards in tier order. */
export const PLAN_ORDER: readonly PlanId[] = ['free', 'pro', 'agency'];

/** Stripe subscription statuses that grant a paid plan's entitlements. */
const ACTIVE_SUBSCRIPTION_STATUSES: ReadonlySet<string> = new Set(['active', 'trialing']);

/**
 * Resolve a Stripe subscription status to the {@link PlanId} whose entitlements apply.
 *
 * A subscription only confers a paid plan while its status is active (or trialing); any other
 * status — `canceled`, `past_due`, `unpaid`, `incomplete`, `incomplete_expired`, `paused`, or a
 * `null`/absent subscription — falls back to `'free'`. This is intentionally conservative: a lapsed
 * subscriber is treated exactly like a free user, never locked out and never over-entitled.
 *
 * @param subscriptionStatus The `status` field from the `subscriptions` row, or `null`/`undefined`
 *   when the user has no subscription.
 * @param plan The `plan` field from the `subscriptions` row, used to pick which paid tier is active.
 *   Defaults to `'pro'` when a status is active but the stored plan is missing or unrecognized.
 * @returns The plan id whose limits should be enforced. Never throws.
 */
export function planFor(
  subscriptionStatus: string | null | undefined,
  plan?: string | null,
): PlanId {
  if (subscriptionStatus == null || !ACTIVE_SUBSCRIPTION_STATUSES.has(subscriptionStatus)) {
    return 'free';
  }
  if (plan === 'agency' || plan === 'pro') {
    return plan;
  }
  // Active subscription with an unknown/missing plan label: grant the lowest paid tier rather than
  // free (they are paying) but never silently grant the highest.
  return 'pro';
}
