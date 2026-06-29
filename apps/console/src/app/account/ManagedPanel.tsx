import type { JSX } from 'react';
import { Badge, SpotlightCard } from '@/components/ui';
import { PLANS } from '@/lib/billing/plans';

/**
 * Account-page panel for the Managed / Autopilot tier (server component).
 *
 * Renders three things, all framed as a **work-delivered SLA**, never an outcome promise:
 *  (a) 90-day work-delivered progress — articles + outreach placements *delivered* (executed
 *      proposals) this period vs. the {@link PLANS.managed} targets (read from the plan, never
 *      hard-coded); shows "—" with a note when the delivery data layer isn't wired yet.
 *  (b) the guarantee **baseline vs. current** visibility snapshot (baseline from
 *      `customer_profiles.guarantee_baseline`; "current" is left as a placeholder until the live
 *      snapshot is wired).
 *  (c) a plain-language guarantee summary ("we deliver the work or we keep working free") linking to
 *      the T&Cs.
 *
 * Dormant-safe: when the managed data layer is absent the panel still renders with placeholders and a
 * configured/none state — it never throws.
 */

/**
 * The 90-day guarantee period ≈ 3 monthly cadence cycles. The displayed targets are the per-month
 * {@link PLANS.managed} limits × this, so the panel renders from the plan and hard-codes no number.
 * Keep in sync with the trailing window used to count delivered proposals in `account/page.tsx`.
 */
const GUARANTEE_PERIOD_MONTHS = 3;

/** Props for {@link ManagedPanel} — a flattened, render-ready view of the managed account data. */
export interface ManagedPanelProps {
  /** Whether a `customer_profiles` row exists for this user (managed onboarding completed). */
  configured: boolean;
  /** Articles delivered (executed `content` proposals) this period, or `null` if data is unavailable. */
  articlesDelivered: number | null;
  /** Outreach placements delivered (executed) this period, or `null` if data is unavailable. */
  placementsDelivered: number | null;
  /** Whether a guarantee baseline snapshot was captured at onboarding. */
  hasBaseline: boolean;
  /** ISO timestamp the managed profile / baseline was captured, or `null`. */
  baselineCapturedAt: string | null;
}

/** Format an ISO timestamp as a short date, or `null` if absent/invalid. */
function formatDate(iso: string | null): string | null {
  if (iso === null) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** One work-delivered SLA row with a progress bar. `delivered === null` renders an unknown ("—") state. */
function SlaRow({
  label,
  delivered,
  target,
}: {
  label: string;
  delivered: number | null;
  target: number;
}): JSX.Element {
  const known = delivered !== null;
  const deliveredValue = delivered ?? 0;
  const pct = known && target > 0 ? Math.min(100, Math.round((deliveredValue / target) * 100)) : 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-slate-300">{label}</span>
        <span className="text-slate-400">{known ? `${deliveredValue} / ${target}` : `— / ${target}`}</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]"
        role="progressbar"
        aria-valuenow={deliveredValue}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-label={`${label} delivered this period`}
      >
        <div
          className="h-full rounded-full bg-[linear-gradient(100deg,#6366F1,#22D3EE)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Render the Managed / Autopilot account panel. */
export function ManagedPanel({
  configured,
  articlesDelivered,
  placementsDelivered,
  hasBaseline,
  baselineCapturedAt,
}: ManagedPanelProps): JSX.Element {
  const limits = PLANS.managed.limits;
  const articlesTarget = (limits.articlesPerMonth ?? 0) * GUARANTEE_PERIOD_MONTHS;
  const placementsTarget = (limits.outreachPlacementsPerMonth ?? 0) * GUARANTEE_PERIOD_MONTHS;
  const deliveryUnavailable = articlesDelivered === null && placementsDelivered === null;
  const baselineDate = formatDate(baselineCapturedAt);

  return (
    <SpotlightCard className="flex flex-col gap-6 p-6 ring-1 ring-brand-violet/30 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Managed · Autopilot
          </span>
          <span className="text-lg font-semibold text-white">90-day work-delivered guarantee</span>
        </div>
        <Badge tone="violet">Managed</Badge>
      </div>

      {/* (a) Work-delivered SLA progress */}
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-slate-400">
          Your guarantee tracks the <span className="text-slate-200">work we deliver</span> over each
          90-day period — published articles and compliant outreach placements — against your
          plan&rsquo;s targets.
        </p>
        <SlaRow label="Articles published" delivered={articlesDelivered} target={articlesTarget} />
        <SlaRow
          label="Outreach placements"
          delivered={placementsDelivered}
          target={placementsTarget}
        />
        {deliveryUnavailable ? (
          // TODO(lead): delivery counts come from `proposals` (status='executed') via the account
          // service-role path. When the managed schema/orchestrator isn't provisioned the query
          // returns null and we render "—" rather than failing.
          <p className="text-xs leading-relaxed text-slate-500">
            Delivery tracking isn&rsquo;t connected on this deployment yet, so counts show
            &ldquo;—&rdquo;. They populate automatically once your managed cadence starts running.
          </p>
        ) : null}
      </div>

      {/* (b) Baseline vs. current visibility snapshot */}
      <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Visibility snapshot
        </span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Baseline (at onboarding)</span>
            <span className="text-sm font-medium text-white">
              {hasBaseline
                ? baselineDate !== null
                  ? `Captured ${baselineDate}`
                  : 'Captured at onboarding'
                : 'Not captured yet'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Current</span>
            <span className="text-sm font-medium text-white">—</span>
          </div>
        </div>
        {/* TODO(lead): surface the live AI-citation snapshot for the "Current" column (the
            ai-visibility report in apps/console) so it reads against `guarantee_baseline`. */}
        <p className="text-xs leading-relaxed text-slate-500">
          We capture an AI-citation baseline at onboarding and measure delivery against it. The live
          snapshot appears here once tracking is connected.
        </p>
      </div>

      {/* (c) Guarantee summary — work-delivered, NOT an outcome promise */}
      <div className="flex flex-col gap-2 rounded-xl border border-brand-violet/20 bg-brand-violet/[0.04] p-4">
        <span className="text-sm font-semibold text-white">How the guarantee works</span>
        <p className="text-sm leading-relaxed text-slate-300">
          If we don&rsquo;t deliver the agreed work in a period,{' '}
          <span className="font-medium text-white">
            we keep working at no extra charge until we do
          </span>
          . It&rsquo;s a work-delivered service guarantee — not a traffic, ranking, or revenue outcome
          promise, which no one can honestly guarantee.
        </p>
        {/* TODO(lead): publish a public /legal/guarantee route from docs/legal/guarantee-terms.md
            (currently a draft skeleton — counsel to finalize before marketing the guarantee). */}
        <a href="/legal/guarantee" className="text-xs font-medium text-brand-cyan hover:underline">
          Read the 90-Day Guarantee Terms &amp; Conditions &rarr;
        </a>
      </div>

      {!configured ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-slate-400">
          Your managed workspace isn&rsquo;t set up yet.{' '}
          <a href="/onboarding" className="text-brand-cyan hover:underline">
            Finish onboarding
          </a>{' '}
          to capture your baseline and start the delivery cadence.
        </p>
      ) : null}
    </SpotlightCard>
  );
}
