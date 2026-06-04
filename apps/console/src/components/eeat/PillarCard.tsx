import type { JSX, ReactNode } from 'react';
import type { EeatPillar, EeatPillarKey } from '@aeo/types';
import { GradeBadge } from '@aeo/ui';
import { scoreToGrade } from '@aeo/scoring';
import { SpotlightCard } from '@/components/ui';
import { cn } from '@/lib/cn';

export interface PillarCardProps {
  pillar: EeatPillar;
}

/** Inline SVG glyph + accent color per E-E-A-T pillar. No icon library. */
const PILLAR_META: Record<EeatPillarKey, { icon: ReactNode; accent: string; ring: string }> = {
  experience: {
    accent: 'text-brand-cyan',
    ring: 'from-brand-cyan/30',
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  expertise: {
    accent: 'text-brand-indigo',
    ring: 'from-brand-indigo/30',
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c3 3 9 3 12 0v-5" />
      </svg>
    ),
  },
  authoritativeness: {
    accent: 'text-brand-violet',
    ring: 'from-brand-violet/30',
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="8" r="6" />
        <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
      </svg>
    ),
  },
  trust: {
    accent: 'text-emerald-400',
    ring: 'from-emerald-400/30',
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
};

/** Map a 0–100 pillar score to a meter fill color (red → amber → emerald). */
function meterColor(score: number): string {
  if (score >= 80) return 'bg-emerald-400';
  if (score >= 50) return 'bg-amber-400';
  return 'bg-red-400';
}

/**
 * One card per E-E-A-T pillar: pillar label + icon, its 0–100 score (with a
 * derived letter grade and progress meter), and the full list of signals marked
 * present or absent with a recommendation for each gap. Dark design system.
 */
export function PillarCard({ pillar }: PillarCardProps): JSX.Element {
  const presentCount = pillar.signals.filter((s) => s.present).length;
  const totalCount = pillar.signals.length;
  const meta = PILLAR_META[pillar.key];
  const headingId = `pillar-${pillar.key}`;

  return (
    <SpotlightCard className="h-full">
      <section className="flex h-full flex-col gap-5 p-6" aria-labelledby={headingId}>
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br to-transparent',
                meta.ring,
                meta.accent,
              )}
            >
              {meta.icon}
            </span>
            <div className="flex flex-col gap-1">
              <h3 id={headingId} className="text-lg font-semibold text-white">
                {pillar.label}
              </h3>
              <p className="text-xs text-slate-400">
                {presentCount} of {totalCount} signals present
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-3xl font-bold tabular-nums text-white">{pillar.score}</span>
            <GradeBadge grade={scoreToGrade(pillar.score)} size="sm" />
          </div>
        </header>

        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]"
          role="progressbar"
          aria-valuenow={pillar.score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${pillar.label} score`}
        >
          <div
            className={cn('h-full rounded-full transition-all', meterColor(pillar.score))}
            style={{ width: `${Math.max(0, Math.min(100, pillar.score))}%` }}
          />
        </div>

        <ul className="flex flex-col gap-2.5" aria-label={`${pillar.label} signals`}>
          {pillar.signals.map((signal) => (
            <li
              key={signal.id}
              className={cn(
                'flex items-start gap-3 rounded-xl border px-3.5 py-3',
                signal.present
                  ? 'border-emerald-400/15 bg-emerald-400/[0.06]'
                  : 'border-white/[0.07] bg-white/[0.02]',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                  signal.present
                    ? 'bg-emerald-400/15 text-emerald-300'
                    : 'bg-red-400/10 text-red-300',
                )}
              >
                {signal.present ? (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                )}
              </span>
              <div className="flex flex-1 flex-col gap-1">
                <span className="text-sm font-medium text-slate-100">
                  {signal.label}
                  <span className="sr-only">{signal.present ? ' (present)' : ' (absent)'}</span>
                </span>
                {signal.evidence ? (
                  <span className="text-xs leading-relaxed text-slate-400">{signal.evidence}</span>
                ) : null}
                {!signal.present ? (
                  <span className="text-xs leading-relaxed text-slate-300">
                    <span className="font-medium text-brand-cyan">Fix: </span>
                    {signal.recommendation}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </SpotlightCard>
  );
}
