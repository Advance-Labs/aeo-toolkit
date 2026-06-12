'use client';

/**
 * Pricing-card call-to-action (client island).
 *
 * Behaviour by plan + auth state:
 *  - **Free** → a link to start auditing (no purchase).
 *  - **Paid + signed out** → a link to `/login` (sign in before checkout).
 *  - **Paid + signed in** → POSTs `{ planId }` to `/api/billing/checkout` and redirects the browser
 *    to the returned Stripe Checkout URL. The client never sends a price id — only the plan id — so
 *    price selection stays server-side (see the checkout route).
 *
 * Dormant-safe: when billing is off, `/api/billing/checkout` answers `503`; this surfaces a calm
 * inline message rather than throwing. The page only renders the paid CTA as a checkout button when
 * `signedIn` AND `billingEnabled` are both true; otherwise it degrades to the sign-in / disabled link.
 */

import { useState, type JSX } from 'react';
import { Button } from '@/components/ui';
import type { PlanId } from '@/lib/billing/plans';

/** Props for {@link PlanCta}. */
export interface PlanCtaProps {
  /** The plan this CTA buys (or `'free'` for the no-purchase tier). */
  planId: PlanId;
  /** Button label, e.g. `"Upgrade to Pro"`. */
  label: string;
  /** Whether a user session is present (drives signed-in vs `/login`). */
  signedIn: boolean;
  /** Whether Stripe billing is configured (drives checkout vs a disabled state). */
  billingEnabled: boolean;
  /** Visual emphasis — the highlighted plan uses the primary button. */
  variant?: 'primary' | 'secondary';
}

type Status = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string };

/**
 * Render the correct CTA for a pricing tier and, for the signed-in paid path, drive Stripe Checkout.
 */
export function PlanCta({
  planId,
  label,
  signedIn,
  billingEnabled,
  variant = 'secondary',
}: PlanCtaProps): JSX.Element {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  // Free tier: never a purchase — point at the tools.
  if (planId === 'free') {
    return (
      <Button href="/tools/audit" variant={variant} className="w-full">
        {label}
      </Button>
    );
  }

  // Billing not configured, or signed out: send to login (or stay calm if dormant).
  if (!billingEnabled || !signedIn) {
    return (
      <Button href="/login" variant={variant} className="w-full">
        {signedIn ? label : 'Sign in to upgrade'}
      </Button>
    );
  }

  async function startCheckout(): Promise<void> {
    setStatus({ kind: 'loading' });
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || data?.url === undefined) {
        setStatus({
          kind: 'error',
          message: data?.error ?? 'Could not start checkout. Please try again.',
        });
        return;
      }
      window.location.assign(data.url);
    } catch {
      setStatus({ kind: 'error', message: 'Could not reach checkout. Please try again.' });
    }
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <Button
        type="button"
        variant={variant}
        className="w-full"
        disabled={status.kind === 'loading'}
        onClick={() => {
          void startCheckout();
        }}
      >
        {status.kind === 'loading' ? 'Starting checkout…' : label}
      </Button>
      {status.kind === 'error' ? (
        <p role="alert" className="text-xs leading-relaxed text-rose-400">
          {status.message}
        </p>
      ) : null}
    </div>
  );
}
