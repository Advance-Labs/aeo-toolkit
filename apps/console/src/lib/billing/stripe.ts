/**
 * Stripe SDK seam for the commercial layer.
 *
 * Two responsibilities, both env-gated so the toolkit ships **dormant** (matches the repo's
 * "lights up when creds are added" convention):
 *  - {@link BILLING_ENABLED}: a boolean derived solely from `STRIPE_SECRET_KEY` presence. The gating
 *    layer reads this and, when false, leaves every tool fully open exactly as it is today.
 *  - {@link getStripe}: a lazily-constructed singleton `Stripe` client. Importing this module never
 *    constructs the client or touches Stripe; the client is built on first call and only throws if
 *    called while unconfigured. This keeps the module importable in dev/CI with no secrets.
 *
 * Required env (all dormant — billing stays off until `STRIPE_SECRET_KEY` is present):
 *  - `STRIPE_SECRET_KEY`      — server-only secret key. Never logged.
 *  - `STRIPE_WEBHOOK_SECRET`  — used by the webhook route to verify signatures.
 *  - `STRIPE_PRICE_PRO`, `STRIPE_PRICE_AGENCY` — the live Stripe Price ids (named in `plans.ts`).
 *  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — client publishable key (used by the pricing UI only).
 *
 * The `stripe` package is a runtime dependency; the assembly builder installs it in
 * `apps/console/package.json`.
 */

import Stripe from 'stripe';

/**
 * Read a non-empty environment variable, returning `undefined` for unset or empty values. Mirrors
 * the existing `token-store.ts` convention so behaviour matches the rest of the app.
 */
function nonEmptyEnv(name: string): string | undefined {
  const value = process.env[name];
  return value !== undefined && value.length > 0 ? value : undefined;
}

/**
 * Whether Stripe billing is configured. `true` only when `STRIPE_SECRET_KEY` is present and
 * non-empty. The entire commercial layer keys off this flag: when `false`, the gating layer treats
 * the site as fully open (every tool free), and the billing API routes short-circuit to a clear
 * "billing not configured" response instead of touching Stripe.
 *
 * Evaluated at module-load from `process.env`. In the Node serverless runtime this is fine — env is
 * fixed for the process lifetime.
 */
export const BILLING_ENABLED: boolean = nonEmptyEnv('STRIPE_SECRET_KEY') !== undefined;

/** Cached singleton so we construct the Stripe client at most once per process. */
let stripeSingleton: Stripe | undefined;

/**
 * Return the shared {@link Stripe} client, constructing it lazily on first use.
 *
 * The client is pinned to the SDK's bundled API version (we deliberately do not pass `apiVersion`
 * so that the version always matches the installed `stripe` package's TypeScript types — pinning a
 * mismatched literal would break the typecheck across SDK upgrades). The secret key is read from
 * `STRIPE_SECRET_KEY` and never logged.
 *
 * @throws {Error} If called while {@link BILLING_ENABLED} is false (i.e. `STRIPE_SECRET_KEY` unset).
 *   Callers in the billing routes must check `BILLING_ENABLED` first and return a graceful response;
 *   this throw is the defensive backstop for a misconfigured deploy.
 */
export function getStripe(): Stripe {
  if (stripeSingleton !== undefined) {
    return stripeSingleton;
  }
  const secretKey = nonEmptyEnv('STRIPE_SECRET_KEY');
  if (secretKey === undefined) {
    throw new Error(
      'getStripe() called while billing is disabled: set STRIPE_SECRET_KEY to enable Stripe.',
    );
  }
  stripeSingleton = new Stripe(secretKey, {
    // No `apiVersion`: use the version pinned by the installed SDK so types always line up.
    typescript: true,
    appInfo: { name: 'AEO Toolkit Console' },
  });
  return stripeSingleton;
}

/**
 * Resolve the configured Stripe Price id for a plan from its `stripePriceEnv` var name.
 *
 * Centralizes the server-side price lookup so client-supplied plan ids can never reach a price:
 * the checkout route maps an untrusted `planId` to `PLANS[planId].stripePriceEnv`, then calls this.
 *
 * @param stripePriceEnv The env var name from `PLANS[planId].stripePriceEnv` (e.g. `STRIPE_PRICE_PRO`).
 * @returns The price id string, or `undefined` if the env var is unset/empty.
 */
export function resolvePriceId(stripePriceEnv: string | null): string | undefined {
  if (stripePriceEnv === null) {
    return undefined;
  }
  return nonEmptyEnv(stripePriceEnv);
}

/**
 * Test-only seam: clear the cached Stripe singleton so a suite can flip env vars between cases.
 * Not used on the production request path.
 */
export function __resetStripeForTests(): void {
  stripeSingleton = undefined;
}
