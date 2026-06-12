/**
 * POST /api/billing/portal — open the Stripe Billing Portal for the signed-in user.
 *
 * Flow: require a session (401 if none) → look up the user's stored Stripe customer id (404 if they
 * have never checked out) → create a Billing Portal session → return `{ url }` for the browser to
 * redirect to (where the user can update payment method, cancel, or see invoices).
 *
 * Dormant-safe: returns 503 when `STRIPE_SECRET_KEY` is unset. Runtime: Node (service-role Supabase
 * + Stripe SDK). No request body is needed; the customer is derived from the session, never the
 * client, so a user can only ever open their own portal.
 */
import { BILLING_ENABLED, getStripe } from '@/lib/billing/stripe';
import { createBillingStore } from '@/lib/billing/store';
import { getSession } from '@/lib/auth/server';
import { SITE_URL } from '@/lib/seo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Create a Billing Portal session and return its URL. The Stripe customer is resolved from the
 * authenticated user's `profiles` row — never from client input — so the portal always scopes to
 * the caller's own billing.
 */
export async function POST(): Promise<Response> {
  if (!BILLING_ENABLED) {
    return Response.json({ error: 'Billing is not configured.' }, { status: 503 });
  }

  const session = await getSession();
  if (session === null) {
    return Response.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const store = createBillingStore();
  if (store === null) {
    return Response.json({ error: 'Billing storage is not configured.' }, { status: 503 });
  }

  const customerId = await store.getCustomerId(session.user.id);
  if (customerId === null) {
    return Response.json({ error: 'No billing account found for this user.' }, { status: 404 });
  }

  const base = SITE_URL.replace(/\/$/, '');
  const portal = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${base}/account`,
  });

  return Response.json({ url: portal.url }, { status: 200 });
}
