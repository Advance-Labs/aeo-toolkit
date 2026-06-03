import type { JSX } from 'react';
import type { EeatPillar } from '@aeo/types';
import { GradeBadge } from '@aeo/ui';
import { scoreToGrade } from '@aeo/scoring';

export interface PillarCardProps {
  pillar: EeatPillar;
}

/**
 * One card per E-E-A-T pillar: pillar label, its 0–100 score (with a derived
 * letter grade), and the full list of signals marked present or absent.
 */
export function PillarCard({ pillar }: PillarCardProps): JSX.Element {
  const presentCount = pillar.signals.filter((s) => s.present).length;
  const totalCount = pillar.signals.length;

  return (
    <section
      className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      aria-labelledby={`pillar-${pillar.key}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 id={`pillar-${pillar.key}`} className="text-lg font-semibold text-slate-900">
            {pillar.label}
          </h3>
          <p className="text-xs text-slate-500">
            {presentCount} of {totalCount} signals present
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold tabular-nums text-slate-900">{pillar.score}</span>
          <GradeBadge grade={scoreToGrade(pillar.score)} size="sm" />
        </div>
      </header>

      <ul className="flex flex-col gap-2" aria-label={`${pillar.label} signals`}>
        {pillar.signals.map((signal) => (
          <li
            key={signal.id}
            className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
          >
            <span
              aria-hidden="true"
              className={
                signal.present
                  ? 'mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700'
                  : 'mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-100 text-[10px] font-bold text-red-700'
              }
            >
              {signal.present ? '✓' : '✕'}
            </span>
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="text-sm font-medium text-slate-800">
                {signal.label}
                <span className="sr-only">{signal.present ? ' (present)' : ' (absent)'}</span>
              </span>
              {signal.evidence ? (
                <span className="text-xs text-slate-500">{signal.evidence}</span>
              ) : null}
              {!signal.present ? (
                <span className="text-xs text-slate-600">{signal.recommendation}</span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
