/**
 * POST /api/billing/webhook — Stripe webhook receiver.
 *
 * Verifies the Stripe signature against the **raw** request body (`STRIPE_WEBHOOK_SECRET`), then
 * upserts the user's subscription state into Supabase via the **service-role** client (RLS bypass —
 * Stripe is the trusted caller here, not a signed-in user). Handles:
 *   - `checkout.session.completed`            → links the Stripe customer + records the subscription
 *   - `customer.subscription.created|updated` → upserts current status / price / period
 *   - `customer.subscription.deleted`         → marks the subscription canceled
 *
 * The handler is **idempotent** (upsert keyed on `user_id`) and returns `200` fast so Stripe does
 * not retry. There is NO session auth — authenticity comes from the signature. When billing is
 * disabled (`STRIPE_SECRET_KEY` unset) the route returns 503 and never touches Stripe.
 *
 * Runtime: Node (raw-body signature verification is not edge-portable here, and we use the
 * service-role Supabase client). The route stays a thin shell; the testable core is
 * {@link handleStripeEvent}, a pure function over an injected {@link BillingStore}.
 */
import type Stripe from 'stripe';

import { BILLING_ENABLED, getStripe } from '@/lib/billing/stripe';
import { planFor } from '@/lib/billing/plans';
import { createBillingStore } from '@/lib/billing/store';
import type { BillingStore, SubscriptionUpsert } from '@/lib/billing/store';

export const runtime = 'nodejs';
// Webhooks are inherently dynamic and must never be cached.
export const dynamic = 'force-dynamic';

/** Header Stripe uses to carry the webhook signature. */
const SIGNATURE_HEADER = 'stripe-signature';

/**
 * Apply a verified Stripe event to the subscription store. Pure over its inputs (no env, no I/O
 * beyond the injected {@link BillingStore}), so unit tests can drive every branch with a fake store.
 *
 * Unhandled event types are ignored (a no-op success) — Stripe sends many events we do not model,
 * and ignoring them keeps the endpoint returning 200 without error. Events that cannot be mapped to
 * a `user_id` (no `client_reference_id` / metadata) are also ignored rather than throwing, so a
 * stray event never wedges the endpoint into retry loops.
 *
 * @param event The verified Stripe event (signature already checked by the caller).
 * @param store The subscription persistence seam (service-role-backed in production).
 * @returns A short, side-effect-describing tag for logging/tests (never contains secrets).
 */
export async function handleStripeEvent(
  event: Stripe.Event,
  store: BillingStore,
): Promise<{ handled: boolean; type: string }> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = resolveUserId(session.client_reference_id, session.metadata);
      const customerId = asId(session.customer);
      if (userId !== null && customerId !== null) {
        await store.linkCustomer(userId, customerId);
      }
      // Subscription details arrive (and are upserted) via the subscription.* events that follow.
      return { handled: userId !== null, type: event.type };
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = resolveUserId(
        subscription.metadata.user_id ?? null,
        subscription.metadata,
      );
      const customerId = asId(subscription.customer);
      const resolvedUserId = userId ?? (customerId !== null
        ? await store.userIdForCustomer(customerId)
        : null);
      if (resolvedUserId === null) {
        return { handled: false, type: event.type };
      }
      const upsert = toSubscriptionUpsert(resolvedUserId, subscription);
      await store.upsertSubscription(upsert);
      return { handled: true, type: event.type };
    }

    default:
      return { handled: false, type: event.type };
  }
}

/**
 * Map a Stripe Subscription onto the row we persist. Reads the first price item for `price_id`,
 * derives the plan label from the subscription status (deleted/canceled → free), and copies the
 * billing-period bookkeeping. No secrets are read here.
 */
function toSubscriptionUpsert(
  userId: string,
  subscription: Stripe.Subscription,
): SubscriptionUpsert {
  const firstItem = subscription.items.data[0];
  const priceId = firstItem?.price?.id ?? null;
  const planLabel = firstItem?.price?.metadata?.plan ?? null;
  // In the current Stripe API the billing period lives on the subscription *item*
  // (`items.data[].current_period_end`), not on the Subscription object.
  const periodEnd = firstItem?.current_period_end;
  return {
    userId,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    priceId,
    plan: planFor(subscription.status, planLabel),
    currentPeriodEnd:
      typeof periodEnd === 'number' ? new Date(periodEnd * 1000).toISOString() : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
  };
}

/**
 * Resolve a Supabase `user_id` from the places Stripe can carry it: a checkout session's
 * `client_reference_id` or either object's `metadata.user_id`. Returns `null` when absent.
 */
function resolveUserId(
  clientReferenceId: string | null,
  metadata: Stripe.Metadata | null | undefined,
): string | null {
  if (clientReferenceId !== null && clientReferenceId.length > 0) {
    return clientReferenceId;
  }
  const fromMeta = metadata?.user_id;
  return fromMeta !== undefined && fromMeta.length > 0 ? fromMeta : null;
}

/** Narrow a Stripe id-or-expandable field to its string id, or `null`. */
function asId(
  value: string | { id: string } | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === 'string' ? value : value.id;
}

/**
 * Route handler: verify the signature, then hand the event to {@link handleStripeEvent}.
 *
 * Always returns 200 on a successfully-verified event (even for ignored types) so Stripe stops
 * retrying. Signature failures return 400; missing billing config returns 503. We never echo the
 * raw body or any secret in the response.
 */
export async function POST(request: Request): Promise<Response> {
  if (!BILLING_ENABLED) {
    return Response.json({ error: 'Billing is not configured.' }, { status: 503 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (webhookSecret === undefined || webhookSecret.length === 0) {
    return Response.json({ error: 'Webhook secret is not configured.' }, { status: 503 });
  }

  const signature = request.headers.get(SIGNATURE_HEADER);
  if (signature === null) {
    return Response.json({ error: 'Missing signature.' }, { status: 400 });
  }

  // Raw body is required for signature verification — do NOT parse as JSON first.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch {
    // Do not leak the verification error detail to the caller.
    return Response.json({ error: 'Signature verification failed.' }, { status: 400 });
  }

  const store = createBillingStore();
  if (store === null) {
    // Stripe is configured but Supabase is not — accept the event so Stripe doesn't hammer retries,
    // but report degraded so the operator notices the missing storage in logs/monitoring.
    return Response.json({ received: true, persisted: false }, { status: 200 });
  }

  try {
    const result = await handleStripeEvent(event, store);
    return Response.json({ received: true, handled: result.handled }, { status: 200 });
  } catch {
    // A storage failure is a 500 so Stripe retries; the event was authentic.
    return Response.json({ error: 'Failed to process event.' }, { status: 500 });
  }
}
