/**
 * POST /api/billing/checkout — start a Stripe Checkout Session for the signed-in user.
 *
 * Flow: require a session (401 if none) → resolve/create the user's Stripe customer and store its id
 * on `profiles` (service-role) → map the **client-supplied** `planId` to its server-side price via
 * `PLANS[planId].stripePriceEnv` (the client never sends a price id — this defeats price tampering)
 * → create a subscription-mode Checkout Session → return `{ url }` for the browser to redirect to.
 *
 * Body: `{ planId: 'pro' | 'agency' }`. `free` is rejected (nothing to charge).
 * Dormant-safe: returns 503 when `STRIPE_SECRET_KEY` is unset, so the route is inert until billing
 * is configured. Runtime: Node (service-role Supabase + Stripe SDK).
 */
import { BILLING_ENABLED, getStripe, resolvePriceId } from '@/lib/billing/stripe';
import { PLANS } from '@/lib/billing/plans';
import type { PlanId } from '@/lib/billing/plans';
import { createBillingStore } from '@/lib/billing/store';
import { getSession } from '@/lib/auth/server';
import { SITE_URL } from '@/lib/seo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Paid plans a checkout may target (free is not purchasable). */
const PURCHASABLE: ReadonlySet<PlanId> = new Set<PlanId>(['pro', 'agency']);

/** Narrow an unknown JSON value to a purchasable {@link PlanId}, or `null`. */
function parsePlanId(value: unknown): PlanId | null {
  if (typeof value !== 'string') {
    return null;
  }
  return PURCHASABLE.has(value as PlanId) ? (value as PlanId) : null;
}

/**
 * Create the Checkout Session and return its hosted URL.
 *
 * Never trusts a client price: the only client input is `planId`, validated against
 * {@link PURCHASABLE}, then resolved to a price id server-side. The user id is carried into the
 * session as both `client_reference_id` and subscription `metadata.user_id` so the webhook can link
 * the resulting subscription back to the user.
 */
export async function POST(request: Request): Promise<Response> {
  if (!BILLING_ENABLED) {
    return Response.json({ error: 'Billing is not configured.' }, { status: 503 });
  }

  const session = await getSession();
  if (session === null) {
    return Response.json({ error: 'Authentication required.' }, { status: 401 });
  }
  const user = session.user;
  const userId = user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const planId = parsePlanId((body as { planId?: unknown } | null)?.planId);
  if (planId === null) {
    return Response.json({ error: 'Unknown or non-purchasable plan.' }, { status: 400 });
  }

  const priceId = resolvePriceId(PLANS[planId].stripePriceEnv);
  if (priceId === undefined) {
    return Response.json({ error: 'Selected plan is not available for purchase.' }, { status: 503 });
  }

  const store = createBillingStore();
  if (store === null) {
    return Response.json({ error: 'Billing storage is not configured.' }, { status: 503 });
  }

  const stripe = getStripe();

  // Reuse the user's Stripe customer if we have one; otherwise create one and persist its id.
  const existingCustomerId = await store.getCustomerId(userId);
  let customerId: string;
  if (existingCustomerId !== null) {
    customerId = existingCustomerId;
  } else {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { user_id: userId },
    });
    customerId = customer.id;
    await store.linkCustomer(userId, customerId);
  }

  const base = SITE_URL.replace(/\/$/, '');
  const checkout = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: userId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}/account?checkout=success`,
    cancel_url: `${base}/pricing?checkout=cancelled`,
    subscription_data: { metadata: { user_id: userId, plan: planId } },
    allow_promotion_codes: true,
  });

  if (checkout.url === null) {
    return Response.json({ error: 'Failed to create checkout session.' }, { status: 502 });
  }

  return Response.json({ url: checkout.url }, { status: 200 });
}
