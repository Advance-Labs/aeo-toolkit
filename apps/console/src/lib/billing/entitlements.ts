/**
 * Entitlements / gating — the keystone of the commercial layer.
 *
 * One helper, {@link checkEntitlement}, guards every billable surface (the five tool API routes and
 * the three MCP routes). It answers a single question: "is this caller allowed to use this feature
 * right now, and if not, what HTTP response should the route return?"
 *
 * DORMANT-SAFE — THE CRITICAL INVARIANT:
 * When billing is not configured ({@link BILLING_ENABLED} is `false`) this module ALWAYS returns
 * `{ ok: true, userId: null, plan: 'free' }` without touching the database, the session, or Stripe.
 * With no new env set the live site therefore behaves exactly as today: all tools free and open, no
 * auth walls, no quotas. Gating only does real work once `STRIPE_SECRET_KEY` is present.
 *
 * When billing IS enabled, the flow is:
 *   1. Resolve the signed-in user (anon-key, cookie-bound, via `@/lib/auth/server`). Auth-requiring
 *      features answer `401` when no user is present.
 *   2. Resolve the user's plan from their `subscriptions` row (service-role read), via `planFor`.
 *   3. For MCP, require `PLANS[plan].limits.mcpAccess` → `402` (payment required) when the plan lacks it.
 *   4. For metered features, count this calendar month's `usage_events` (service-role) and compare to
 *      `PLANS[plan].limits.auditsPerMonth` → `429` (with an upgrade hint) when the quota is exhausted.
 *   5. On success, append a `usage_events` row (service-role) so the next request sees the new count.
 *
 * The decision logic is a pure function, {@link evaluateEntitlement}, with no I/O — exhaustively
 * unit-tested in `entitlements.test.ts`. `checkEntitlement` is the thin I/O shell around it.
 *
 * All Supabase access here is **service-role** (writes bypass RLS), mirroring `lib/billing/store.ts`
 * and the existing token-store convention. The anon/cookie client is used only to identify the user.
 */

import { createSupabaseClient } from '@advance-labs/storage';

import { BILLING_ENABLED } from './stripe';
import { PLANS, planFor, type PlanId } from './plans';

/**
 * Whether the done-for-you Managed tier is live on this deploy. Gated by its own env (the managed
 * Stripe price) so the `managed` feature is **inert-when-dormant**: unlike the free tools — which fail
 * *open* to `free` when billing is off — `managed` returns a closed denial unless explicitly enabled.
 * (Security review M1: managed routes must not inherit "open when dormant".)
 */
const MANAGED_ENABLED: boolean = nonEmptyEnv('STRIPE_PRICE_MANAGED') !== undefined;

/**
 * The single auth dependency the gate needs, narrowed to what we call. We resolve the real
 * implementation (`@/lib/auth/server` `getUser`) via a **call-time dynamic import** inside
 * {@link checkEntitlement}, never at module load. This keeps `entitlements.ts` importable — and its
 * pure core ({@link evaluateEntitlement}) unit-testable — without pulling the `@supabase/ssr` auth
 * chain into modules (or test runners) that only need the decision logic. On the dormant path the
 * import is never reached, so the live site stays exactly as today with no auth deps required.
 */
interface AuthUser {
  id: string;
  email?: string | null;
}

/**
 * A billable feature. Maps 1:1 to a `usage_events.feature` value and to a quota in {@link PLANS}.
 * `audit`, `graph`, and `chat` are metered against `auditsPerMonth`; `mcp` is gated by `mcpAccess`.
 */
export type Feature = 'audit' | 'mcp' | 'graph' | 'chat' | 'managed';

/**
 * Resolved entitlement snapshot for a caller. Returned by the pure core; `allow=false` carries a
 * machine-readable {@link Entitlement.reason} the shell maps to an HTTP status + JSON body.
 */
export interface Entitlement {
  /** The plan whose limits were evaluated. */
  plan: PlanId;
  /** The authenticated user id, or `null` when no user is signed in (dormant or anonymous). */
  userId: string | null;
  /** Whether the feature call is permitted. */
  allow: boolean;
  /** Why the call was denied; absent when `allow` is `true`. */
  reason?: 'auth_required' | 'quota_exceeded' | 'mcp_not_in_plan' | 'managed_not_in_plan';
}

/** HTTP status codes the gate can deny with: 401 unauth, 402 payment required, 429 over quota. */
export type DenyStatus = 401 | 402 | 429;

/** Success result of {@link checkEntitlement}: the caller may proceed. */
export interface EntitlementOk {
  ok: true;
  /** Authenticated user id, or `null` when billing is dormant or the feature is anonymous-allowed. */
  userId: string | null;
  /** The plan whose limits applied. `'free'` in dormant mode. */
  plan: PlanId;
}

/** Denial result of {@link checkEntitlement}: the route should return `status` with `body` as JSON. */
export interface EntitlementDenied {
  ok: false;
  /** The HTTP status the route must answer with. */
  status: DenyStatus;
  /** A JSON-serializable error body (never contains secrets). */
  body: EntitlementErrorBody;
}

/** Shape of the JSON error body returned on denial; stable so clients can branch on `reason`. */
export interface EntitlementErrorBody {
  /** Human-readable, end-user-safe message. */
  error: string;
  /** Machine-readable denial reason, mirrors {@link Entitlement.reason}. */
  reason: 'auth_required' | 'quota_exceeded' | 'mcp_not_in_plan' | 'managed_not_in_plan';
  /** Present on quota/plan denials: the plan that would lift the limit (e.g. `'pro'`). */
  upgradeTo?: PlanId;
}

/** The result of a {@link checkEntitlement} call. */
export type EntitlementResult = EntitlementOk | EntitlementDenied;

/**
 * Which features require a signed-in user when billing is enabled. MCP and the metered tools all run
 * against a per-user quota, so they need an identity; there is no anonymous billable tier. (When
 * billing is dormant this is moot — every feature is open and `userId` is `null`.)
 */
const REQUIRES_AUTH: Record<Feature, boolean> = {
  audit: true,
  mcp: true,
  graph: true,
  chat: true,
  managed: true,
};

/** Features metered against the per-month `auditsPerMonth` quota (vs. the boolean `mcpAccess` gate). */
const METERED: Record<Feature, boolean> = {
  audit: true,
  graph: true,
  chat: true,
  mcp: false,
  // `managed` is a boolean entitlement (like `mcp`), gated by `managedAccess`, not metered here.
  // The per-month article/outreach delivery quotas are enforced by the orchestrator cadence.
  managed: false,
};

/**
 * The lowest plan whose limits would admit `feature`, used to populate the `upgradeTo` hint. MCP and
 * the metered tools are both unlocked at `pro`, so `pro` is the universal upgrade target for v1.
 */
const UPGRADE_TARGET: PlanId = 'pro';

/**
 * Pure entitlement decision — no I/O, fully deterministic, exhaustively unit-tested.
 *
 * Given a resolved `plan`, the caller's `usageCount` for the current month, and the requested
 * `feature`, decide whether the call is allowed and (if not) why. This function assumes the user has
 * already been identified by the caller; auth resolution and the `401` path live in
 * {@link checkEntitlement} because they require I/O. `userId` is threaded through only so the result
 * snapshot is complete.
 *
 * Rules:
 *  - `mcp`: allowed iff `PLANS[plan].limits.mcpAccess` is `true`; otherwise denied `mcp_not_in_plan`.
 *  - metered features (`audit`/`graph`/`chat`): allowed iff under the monthly cap. A cap of `-1`
 *    means unlimited (always allowed). Otherwise allowed iff `usageCount < cap`; when the count has
 *    reached the cap the call is denied `quota_exceeded`.
 *
 * @param plan The plan whose limits to enforce.
 * @param usageCount The number of `usage_events` already recorded for this user in the current month.
 * @param feature The feature being requested.
 * @param userId The authenticated user id (or `null`); echoed into the result, not used in the decision.
 * @returns A complete {@link Entitlement} snapshot. Never throws.
 */
export function evaluateEntitlement(
  plan: PlanId,
  usageCount: number,
  feature: Feature,
  userId: string | null = null,
): Entitlement {
  const limits = PLANS[plan].limits;

  if (feature === 'mcp') {
    if (!limits.mcpAccess) {
      return { plan, userId, allow: false, reason: 'mcp_not_in_plan' };
    }
    return { plan, userId, allow: true };
  }

  if (feature === 'managed') {
    if (!limits.managedAccess) {
      return { plan, userId, allow: false, reason: 'managed_not_in_plan' };
    }
    return { plan, userId, allow: true };
  }

  // Metered features: -1 means unlimited; otherwise enforce the monthly cap.
  const cap = limits.auditsPerMonth;
  if (cap !== -1 && usageCount >= cap) {
    return { plan, userId, allow: false, reason: 'quota_exceeded' };
  }
  return { plan, userId, allow: true };
}

/** Read a non-empty env var, returning `undefined` for unset/empty — matches `store.ts`/token-store. */
function nonEmptyEnv(name: string): string | undefined {
  const value = process.env[name];
  return value !== undefined && value.length > 0 ? value : undefined;
}

/**
 * Service-role Supabase client for the gating reads/writes, or `null` when Supabase env is absent.
 *
 * Mirrors `lib/billing/store.ts`: the gate's subscription read, usage count, and usage insert all
 * bypass RLS via the **service-role** key (the anon/cookie client is used only to identify the user).
 * Returns `null` on a half-configured deploy so callers fail open (treat as free) rather than throw.
 */
function createServiceClient(): ReturnType<typeof createSupabaseClient> | null {
  const url = nonEmptyEnv('SUPABASE_URL');
  const serviceKey = nonEmptyEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (url === undefined || serviceKey === undefined) {
    return null;
  }
  return createSupabaseClient({ url, serviceKey });
}

/** First day of the current UTC calendar month, as an ISO timestamp — the start of the quota window. */
function startOfMonthIso(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/**
 * Resolve a user's active plan from their `subscriptions` row (service-role read).
 *
 * Reads `status` + `plan` and runs them through {@link planFor}, which conservatively maps any
 * non-active status (or a missing row) to `'free'`. Any read error also falls back to `'free'` so a
 * transient DB problem never locks a user out.
 *
 * @param client A service-role Supabase client.
 * @param userId The authenticated user id.
 * @returns The plan id whose limits should be enforced. Never throws.
 */
async function resolvePlan(
  client: NonNullable<ReturnType<typeof createSupabaseClient>>,
  userId: string,
): Promise<PlanId> {
  const { data, error } = await client
    .from('subscriptions')
    .select('status, plan')
    .eq('user_id', userId)
    .maybeSingle();
  if (error !== null || data === null) {
    return 'free';
  }
  const row = data as { status: string | null; plan: string | null };
  return planFor(row.status, row.plan);
}

/**
 * Count a user's `usage_events` for the current calendar month (service-role read).
 *
 * Uses a head-count query (`count: 'exact', head: true`) over the composite
 * `(user_id, created_at)` index so the hot path transfers no rows. On any error the count is treated
 * as `0` — failing open keeps the site usable through a transient DB blip rather than wrongly 429-ing.
 *
 * @param client A service-role Supabase client.
 * @param userId The authenticated user id.
 * @returns The number of events recorded this month. Never throws.
 */
async function countMonthlyUsage(
  client: NonNullable<ReturnType<typeof createSupabaseClient>>,
  userId: string,
): Promise<number> {
  const { count, error } = await client
    .from('usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfMonthIso());
  if (error !== null || count === null || count === undefined) {
    return 0;
  }
  return count;
}

/**
 * Append one `usage_events` row for a successful, metered feature call (service-role write).
 *
 * Best-effort: a failed insert is swallowed (logged-free, never throws) so a metering hiccup cannot
 * break the user's actual request — the worst case is one uncounted use, never a false denial. MCP
 * is not metered, so it records no row.
 *
 * @param client A service-role Supabase client.
 * @param userId The authenticated user id.
 * @param feature The feature that succeeded.
 */
async function recordUsage(
  client: NonNullable<ReturnType<typeof createSupabaseClient>>,
  userId: string,
  feature: Feature,
): Promise<void> {
  try {
    await client.from('usage_events').insert({ user_id: userId, feature });
  } catch {
    // Metering is best-effort; never fail the user's request because the meter write failed.
  }
}

/**
 * The closed denial returned for the `managed` feature when the Managed tier is not enabled on this
 * deploy. Security M1: managed is inert-when-dormant, so it returns a payment-required denial rather
 * than the free tools' open `{ ok: true, plan: 'free' }`.
 */
const MANAGED_CLOSED: EntitlementDenied = {
  ok: false,
  status: 402,
  body: {
    error: 'The Managed (Autopilot) plan is not available on this workspace.',
    reason: 'managed_not_in_plan',
  },
};

/** Map a pure {@link Entitlement} denial to the HTTP status + JSON body the route should return. */
function denyFor(entitlement: Entitlement): EntitlementDenied {
  const plan = entitlement.plan;
  switch (entitlement.reason) {
    case 'auth_required':
      return {
        ok: false,
        status: 401,
        body: { error: 'Sign in to use this feature.', reason: 'auth_required' },
      };
    case 'mcp_not_in_plan':
      return {
        ok: false,
        status: 402,
        body: {
          error: `MCP access requires the ${PLANS[UPGRADE_TARGET].name} plan or higher.`,
          reason: 'mcp_not_in_plan',
          upgradeTo: UPGRADE_TARGET,
        },
      };
    case 'managed_not_in_plan':
      return {
        ok: false,
        status: 402,
        body: {
          error: 'The done-for-you Managed plan is required for this action.',
          reason: 'managed_not_in_plan',
          upgradeTo: 'managed',
        },
      };
    case 'quota_exceeded':
    default:
      return {
        ok: false,
        status: 429,
        body: {
          error: `You've used all ${PLANS[plan].limits.auditsPerMonth} of this month's runs on the ${PLANS[plan].name} plan. Upgrade for more.`,
          reason: 'quota_exceeded',
          upgradeTo: UPGRADE_TARGET,
        },
      };
  }
}

/**
 * Guard a billable feature call. The single entry point used by every tool + MCP route.
 *
 * DORMANT-SAFE: when {@link BILLING_ENABLED} is `false`, returns `{ ok: true, userId: null,
 * plan: 'free' }` immediately — no session lookup, no DB, no Stripe. The site stays fully open exactly
 * as today. (This is the first and most important branch; do not move it.)
 *
 * When billing is enabled it resolves the user, plan, and monthly usage, evaluates the pure core, and
 * on success records a usage event. Any infrastructure gap (Supabase env missing) fails **open** —
 * the request is allowed — so a half-configured deploy degrades to "free and open" rather than 500ing.
 *
 * @param _req The incoming request. Reserved for future per-request signals (e.g. IP-scoped limits);
 *   the session is read from cookies via `@/lib/auth/server`, not from this argument.
 * @param feature The feature being requested.
 * @returns `{ ok: true, ... }` to proceed, or `{ ok: false, status, body }` for the route to return verbatim.
 */
export async function checkEntitlement(
  _req: Request,
  feature: Feature,
): Promise<EntitlementResult> {
  // ── MANAGED CARVE-OUT (security M1): inert-when-dormant, NOT open-when-dormant. ──
  // The managed feature must never inherit the free tools' "open when billing off" behavior. When the
  // Managed tier isn't enabled (or billing is dormant and we cannot resolve an entitlement), it is
  // closed, not free-and-open.
  if (feature === 'managed' && !MANAGED_ENABLED) {
    return MANAGED_CLOSED;
  }

  // ── DORMANT PATH: billing off → fully open, exactly as today (self-serve tools only). ──
  // Returns before any auth/DB import is touched, so the live site needs no auth deps when dormant.
  if (!BILLING_ENABLED) {
    if (feature === 'managed') {
      return MANAGED_CLOSED;
    }
    return { ok: true, userId: null, plan: 'free' };
  }

  // Identify the caller (anon/cookie client). The auth module is imported lazily here — only on the
  // billing-enabled path — so importing this module never requires the `@supabase/ssr` chain.
  const { getUser } = await import('@/lib/auth/server');
  const user: AuthUser | null = await getUser();
  if (user === null) {
    if (REQUIRES_AUTH[feature]) {
      return denyFor({ plan: 'free', userId: null, allow: false, reason: 'auth_required' });
    }
    return { ok: true, userId: null, plan: 'free' };
  }

  // Without a service-role client we cannot read the plan/usage; fail open as free.
  const client = createServiceClient();
  if (client === null) {
    return { ok: true, userId: user.id, plan: 'free' };
  }

  const plan = await resolvePlan(client, user.id);
  const usageCount = METERED[feature] ? await countMonthlyUsage(client, user.id) : 0;

  const decision = evaluateEntitlement(plan, usageCount, feature, user.id);
  if (!decision.allow) {
    return denyFor(decision);
  }

  // Allowed: record a usage event for metered features so the next call sees the new count.
  if (METERED[feature]) {
    await recordUsage(client, user.id, feature);
  }

  return { ok: true, userId: user.id, plan };
}
