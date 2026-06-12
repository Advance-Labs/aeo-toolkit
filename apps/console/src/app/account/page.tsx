import type { JSX } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createSupabaseClient } from '@aeo/storage';
import { Badge, Button, GradientText, Section, SpotlightCard } from '@/components/ui';
import { AUTH_ENABLED } from '@/lib/auth';
import { getUser } from '@/lib/auth/server';
import { BILLING_ENABLED } from '@/lib/billing/stripe';
import { PLANS, planFor, type PlanId } from '@/lib/billing/plans';
import { AccountActions } from './AccountActions';

export const runtime = 'nodejs';
// Per-user, session-bound — never cached.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Account',
  description: 'Manage your AEO Toolkit plan, usage, and billing.',
  // Utility page — keep it out of search/AI indexes.
  robots: { index: false, follow: false },
  alternates: { canonical: '/account' },
};

/** Read a non-empty env var, returning `undefined` for unset/empty — matches `store.ts`. */
function nonEmptyEnv(name: string): string | undefined {
  const value = process.env[name];
  return value !== undefined && value.length > 0 ? value : undefined;
}

/** First day of the current UTC month as an ISO timestamp — the start of the usage window. */
function startOfMonthIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** What the page needs to render: the resolved plan, this-month usage, and subscription presence. */
interface AccountData {
  plan: PlanId;
  usageThisMonth: number;
  hasSubscription: boolean;
}

/**
 * Load the signed-in user's plan + monthly usage via the **service-role** client (bypasses RLS,
 * same pattern as `lib/billing/store.ts`). Fails soft: any missing env or read error degrades to the
 * free plan with zero usage so the page always renders.
 */
async function loadAccountData(userId: string): Promise<AccountData> {
  const url = nonEmptyEnv('SUPABASE_URL');
  const serviceKey = nonEmptyEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (url === undefined || serviceKey === undefined) {
    return { plan: 'free', usageThisMonth: 0, hasSubscription: false };
  }
  const client = createSupabaseClient({ url, serviceKey });

  const [subResult, usageResult] = await Promise.all([
    client.from('subscriptions').select('status, plan').eq('user_id', userId).maybeSingle(),
    client
      .from('usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', startOfMonthIso()),
  ]);

  const subRow =
    subResult.error === null && subResult.data !== null
      ? (subResult.data as { status: string | null; plan: string | null })
      : null;
  const plan = subRow !== null ? planFor(subRow.status, subRow.plan) : 'free';
  const usageThisMonth =
    usageResult.error === null && typeof usageResult.count === 'number' ? usageResult.count : 0;

  return { plan, usageThisMonth, hasSubscription: subRow !== null && plan !== 'free' };
}

/** Format a monthly limit for display: `-1` (unlimited) renders as "Unlimited". */
function formatLimit(limit: number): string {
  return limit === -1 ? 'Unlimited' : String(limit);
}

/**
 * Account dashboard. Server component.
 *
 * Auth states:
 *  - **Auth dormant** (no Supabase auth env): renders a calm "accounts aren't enabled" notice — there
 *    is nothing to sign into and every tool is already free and open.
 *  - **Auth enabled, signed out**: redirects to `/login`.
 *  - **Signed in**: shows the current plan, this-month usage vs. the plan limit, and billing actions.
 */
export default async function AccountPage(): Promise<JSX.Element> {
  // Dormant: auth isn't configured, so there's no session to require. Show a friendly notice.
  if (!AUTH_ENABLED) {
    return (
      <Section className="pt-12 sm:pt-20">
        <div className="mx-auto flex w-full max-w-md flex-col gap-6">
          <header className="flex flex-col gap-4 text-center">
            <div className="flex justify-center">
              <Badge tone="cyan">Account</Badge>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Accounts aren&rsquo;t <GradientText>enabled yet</GradientText>
            </h1>
          </header>
          <SpotlightCard className="flex flex-col gap-3 p-6 text-center sm:p-8">
            <p className="text-sm leading-relaxed text-slate-400">
              Sign-in and billing aren&rsquo;t turned on for this deployment. Every tool is already
              free and open with no limits — head back and start auditing.
            </p>
            <div className="mt-2 flex justify-center">
              <Button href="/tools/audit" variant="secondary">
                Run a free audit
              </Button>
            </div>
          </SpotlightCard>
        </div>
      </Section>
    );
  }

  // Auth enabled: require a session.
  const user = await getUser();
  if (user === null) {
    redirect('/login');
  }

  const { plan, usageThisMonth, hasSubscription } = await loadAccountData(user.id);
  const planMeta = PLANS[plan];
  const limit = planMeta.limits.auditsPerMonth;
  const limitLabel = formatLimit(limit);
  const usagePct = limit === -1 ? 0 : Math.min(100, Math.round((usageThisMonth / limit) * 100));
  const overQuota = limit !== -1 && usageThisMonth >= limit;

  // Offer the next tier up as the upgrade target (free → pro → agency).
  const upgradeTo: PlanId | null = plan === 'free' ? 'pro' : plan === 'pro' ? 'agency' : null;

  return (
    <Section className="pt-12 sm:pt-20">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="flex flex-col gap-3">
          <Badge tone="cyan">Account</Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Your <GradientText>{planMeta.name}</GradientText> plan
          </h1>
          <p className="text-sm leading-relaxed text-slate-400">
            Signed in as <span className="font-medium text-white">{user.email ?? 'your account'}</span>.
          </p>
        </header>

        {/* Plan + usage */}
        <SpotlightCard className="flex flex-col gap-6 p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Current plan
              </span>
              <span className="text-lg font-semibold text-white">
                {planMeta.name} · ${planMeta.priceUsdMonthly}/mo
              </span>
            </div>
            <Badge tone={plan === 'free' ? 'neutral' : 'violet'}>{planMeta.name}</Badge>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium text-slate-300">Usage this month</span>
              <span className="text-slate-400">
                {usageThisMonth} / {limitLabel}
              </span>
            </div>
            {limit !== -1 ? (
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]"
                role="progressbar"
                aria-valuenow={usageThisMonth}
                aria-valuemin={0}
                aria-valuemax={limit}
                aria-label="Monthly usage"
              >
                <div
                  className={
                    overQuota
                      ? 'h-full rounded-full bg-rose-500'
                      : 'h-full rounded-full bg-[linear-gradient(100deg,#6366F1,#22D3EE)]'
                  }
                  style={{ width: `${usagePct}%` }}
                />
              </div>
            ) : (
              <p className="text-xs leading-relaxed text-slate-500">
                Unlimited runs on the {planMeta.name} plan.
              </p>
            )}
            {overQuota ? (
              <p className="text-xs leading-relaxed text-rose-400">
                You&rsquo;ve hit this month&rsquo;s limit.{' '}
                {upgradeTo !== null ? 'Upgrade for more runs.' : ''}
              </p>
            ) : null}
          </div>

          {!BILLING_ENABLED ? (
            <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-slate-400">
              Billing isn&rsquo;t configured on this deployment, so there&rsquo;s nothing to pay for —
              every tool is free and open.
            </p>
          ) : null}

          <AccountActions
            billingEnabled={BILLING_ENABLED}
            hasSubscription={hasSubscription}
            upgradeTo={upgradeTo}
          />
        </SpotlightCard>

        <p className="text-center text-xs leading-relaxed text-slate-500">
          See all plans on the <a href="/pricing" className="text-brand-cyan hover:underline">pricing page</a>.
        </p>
      </div>
    </Section>
  );
}
