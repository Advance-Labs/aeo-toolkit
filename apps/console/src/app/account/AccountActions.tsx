'use client';

/**
 * Account-page action buttons (client island): manage billing, upgrade, and sign out.
 *
 *  - **Manage billing** POSTs `/api/billing/portal` and redirects to the Stripe Billing Portal.
 *  - **Upgrade** POSTs `/api/billing/checkout` with the target `planId` and redirects to Checkout.
 *  - **Sign out** clears the Supabase session via the browser client, then returns to `/`.
 *
 * Dormant-safe: when billing is off the billing endpoints answer `503`; this surfaces a calm inline
 * message instead of throwing. Sign-out works whenever auth is configured; otherwise it no-ops.
 */

import { useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { createBrowserSupabase } from '@/lib/auth/client';
import type { PlanId } from '@/lib/billing/plans';

/** Props for {@link AccountActions}. */
export interface AccountActionsProps {
  /** Whether Stripe billing is configured (shows billing/upgrade buttons). */
  billingEnabled: boolean;
  /** Whether the user already has a paid subscription (shows "Manage billing" vs "Upgrade"). */
  hasSubscription: boolean;
  /** The plan to offer as the upgrade target when the user is on a lower tier, or `null` if none. */
  upgradeTo: PlanId | null;
}

type Status = { kind: 'idle' } | { kind: 'busy'; action: string } | { kind: 'error'; message: string };

/** POST a billing endpoint and redirect to the returned URL; sets an inline error otherwise. */
async function goToBilling(
  path: '/api/billing/portal' | '/api/billing/checkout',
  body: Record<string, unknown> | null,
): Promise<string | { error: string }> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === null ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!res.ok || data?.url === undefined) {
    return { error: data?.error ?? 'Something went wrong. Please try again.' };
  }
  return data.url;
}

/** Render the account actions and drive the billing/auth flows they trigger. */
export function AccountActions({
  billingEnabled,
  hasSubscription,
  upgradeTo,
}: AccountActionsProps): JSX.Element {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function handleManage(): Promise<void> {
    setStatus({ kind: 'busy', action: 'portal' });
    const result = await goToBilling('/api/billing/portal', null);
    if (typeof result === 'string') {
      window.location.assign(result);
      return;
    }
    setStatus({ kind: 'error', message: result.error });
  }

  async function handleUpgrade(planId: PlanId): Promise<void> {
    setStatus({ kind: 'busy', action: 'checkout' });
    const result = await goToBilling('/api/billing/checkout', { planId });
    if (typeof result === 'string') {
      window.location.assign(result);
      return;
    }
    setStatus({ kind: 'error', message: result.error });
  }

  async function handleSignOut(): Promise<void> {
    setStatus({ kind: 'busy', action: 'signout' });
    const supabase = createBrowserSupabase();
    if (supabase !== null) {
      await supabase.auth.signOut();
    }
    router.push('/');
    router.refresh();
  }

  const busy = status.kind === 'busy';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {billingEnabled && hasSubscription ? (
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => {
              void handleManage();
            }}
          >
            {status.kind === 'busy' && status.action === 'portal' ? 'Opening…' : 'Manage billing'}
          </Button>
        ) : null}

        {billingEnabled && upgradeTo !== null ? (
          <Button
            type="button"
            variant="primary"
            disabled={busy}
            onClick={() => {
              void handleUpgrade(upgradeTo);
            }}
          >
            {status.kind === 'busy' && status.action === 'checkout'
              ? 'Starting…'
              : `Upgrade to ${upgradeTo === 'agency' ? 'Agency' : 'Pro'}`}
          </Button>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            void handleSignOut();
          }}
        >
          Sign out
        </Button>
      </div>

      {status.kind === 'error' ? (
        <p role="alert" className="text-sm text-rose-400">
          {status.message}
        </p>
      ) : null}
    </div>
  );
}
