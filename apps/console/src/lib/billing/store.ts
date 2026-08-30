/**
 * Billing persistence seam — the service-role Supabase writes the billing layer needs.
 *
 * The webhook (Stripe-signed, no user session) and the checkout/portal routes (server actions on
 * behalf of a signed-in user) all mutate the `profiles` and `subscriptions` tables. Those writes
 * MUST bypass RLS, so they go through the **service-role** client (`@advance-labs/storage`
 * `createSupabaseClient`), exactly as the existing token-store does. This module wraps that client
 * behind a tiny, fully-typed {@link BillingStore} interface so the webhook's pure
 * `handleStripeEvent` can be unit-tested against an in-memory fake with no network.
 *
 * Env-gated: {@link createBillingStore} returns `null` when `SUPABASE_URL` /
 * `SUPABASE_SERVICE_ROLE_KEY` are absent, so the routes degrade gracefully instead of throwing on a
 * half-configured deploy. Tables match `supabase/schema-billing.sql` (owned by the auth builder).
 */
import { createSupabaseClient } from '@advance-labs/storage';

import type { PlanId } from './plans';

/** Table holding one billing profile per auth user (Stripe customer link). */
const PROFILES_TABLE = 'profiles';
/** Table holding the current subscription state per auth user. */
const SUBSCRIPTIONS_TABLE = 'subscriptions';

/** The subscription row shape the webhook upserts. Mirrors `subscriptions` in schema-billing.sql. */
export interface SubscriptionUpsert {
  /** Auth user id (primary key of `subscriptions`). */
  userId: string;
  /** Stripe subscription id (`sub_...`). */
  stripeSubscriptionId: string;
  /** Raw Stripe status (`active`, `canceled`, `past_due`, ...). */
  status: string;
  /** Stripe price id of the first line item, or `null`. */
  priceId: string | null;
  /** Resolved plan label persisted for fast reads (`free` | `pro` | `agency`). */
  plan: PlanId;
  /** ISO-8601 timestamp when the current period ends, or `null`. */
  currentPeriodEnd: string | null;
  /** Whether the subscription is set to cancel at period end. */
  cancelAtPeriodEnd: boolean;
}

/**
 * The writes/reads the billing layer performs against Supabase. Implementations use the service-role
 * client. Tests substitute an in-memory fake with the same surface.
 */
export interface BillingStore {
  /**
   * Persist the Stripe customer id on a user's profile (idempotent; upsert on `id`). Called from
   * checkout (first purchase) and from `checkout.session.completed`.
   */
  linkCustomer(userId: string, stripeCustomerId: string): Promise<void>;

  /** Return the Stripe customer id stored for a user, or `null` if none is linked yet. */
  getCustomerId(userId: string): Promise<string | null>;

  /**
   * Reverse-lookup the auth user id for a Stripe customer id, used by subscription.* webhook events
   * that carry the customer but not the user. Returns `null` when no profile matches.
   */
  userIdForCustomer(stripeCustomerId: string): Promise<string | null>;

  /** Idempotently upsert the user's subscription row (keyed on `user_id`). */
  upsertSubscription(row: SubscriptionUpsert): Promise<void>;
}

/** Read a non-empty env var, returning `undefined` for unset/empty — matches token-store.ts. */
function nonEmptyEnv(name: string): string | undefined {
  const value = process.env[name];
  return value !== undefined && value.length > 0 ? value : undefined;
}

/**
 * Service-role-backed {@link BillingStore}. Constructed only when Supabase env is present (via
 * {@link createBillingStore}); never persists a browser session (the underlying client disables it).
 */
class SupabaseBillingStore implements BillingStore {
  private readonly client: ReturnType<typeof createSupabaseClient>;

  constructor(url: string, serviceKey: string) {
    this.client = createSupabaseClient({ url, serviceKey });
  }

  async linkCustomer(userId: string, stripeCustomerId: string): Promise<void> {
    const { error } = await this.client
      .from(PROFILES_TABLE)
      .upsert({ id: userId, stripe_customer_id: stripeCustomerId }, { onConflict: 'id' });
    if (error !== null) {
      throw new Error(`Failed to link Stripe customer: ${error.message}`);
    }
  }

  async getCustomerId(userId: string): Promise<string | null> {
    const { data, error } = await this.client
      .from(PROFILES_TABLE)
      .select('stripe_customer_id')
      .eq('id', userId)
      .maybeSingle();
    if (error !== null) {
      throw new Error(`Failed to read Stripe customer: ${error.message}`);
    }
    const customerId = (data as { stripe_customer_id: string | null } | null)?.stripe_customer_id;
    return customerId !== undefined && customerId !== null && customerId.length > 0
      ? customerId
      : null;
  }

  async userIdForCustomer(stripeCustomerId: string): Promise<string | null> {
    const { data, error } = await this.client
      .from(PROFILES_TABLE)
      .select('id')
      .eq('stripe_customer_id', stripeCustomerId)
      .maybeSingle();
    if (error !== null) {
      throw new Error(`Failed to resolve user for customer: ${error.message}`);
    }
    const id = (data as { id: string } | null)?.id;
    return id !== undefined && id.length > 0 ? id : null;
  }

  async upsertSubscription(row: SubscriptionUpsert): Promise<void> {
    const { error } = await this.client.from(SUBSCRIPTIONS_TABLE).upsert(
      {
        user_id: row.userId,
        stripe_subscription_id: row.stripeSubscriptionId,
        status: row.status,
        price_id: row.priceId,
        plan: row.plan,
        current_period_end: row.currentPeriodEnd,
        cancel_at_period_end: row.cancelAtPeriodEnd,
      },
      { onConflict: 'user_id' },
    );
    if (error !== null) {
      throw new Error(`Failed to upsert subscription: ${error.message}`);
    }
  }
}

/**
 * Build the service-role {@link BillingStore} when Supabase is configured, else `null`.
 *
 * Returns `null` (rather than throwing) when `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are
 * missing so callers can degrade gracefully on a half-configured deploy. The service-role key is
 * server-only and never logged.
 */
export function createBillingStore(): BillingStore | null {
  const url = nonEmptyEnv('SUPABASE_URL');
  const serviceKey = nonEmptyEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (url === undefined || serviceKey === undefined) {
    return null;
  }
  return new SupabaseBillingStore(url, serviceKey);
}
