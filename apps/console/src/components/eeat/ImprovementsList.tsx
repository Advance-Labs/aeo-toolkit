import type { JSX } from 'react';
import { Card } from '@/components/ui';

export interface ImprovementsListProps {
  improvements: string[];
}

/**
 * The ordered list of recommended improvements (recommendations of every absent
 * signal, heaviest-weight first — as produced by `eeatScore`). Dark design system.
 */
export function ImprovementsList({ improvements }: ImprovementsListProps): JSX.Element {
  if (improvements.length === 0) {
    return (
      <Card className="border-emerald-400/20 bg-emerald-400/[0.04]">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-emerald-200">No improvements needed</h2>
            <p className="text-sm text-emerald-100/80">
              Every E-E-A-T signal we check for is present. Nice work.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-brand-violet/25 to-transparent text-brand-violet"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m12 14 4-4" />
              <path d="M3.34 19a10 10 0 1 1 17.32 0" />
            </svg>
          </span>
          <h2 className="text-lg font-semibold text-white">
            Prioritized improvements <span className="text-slate-400">({improvements.length})</span>
          </h2>
        </div>

        <ol className="flex flex-col gap-2.5">
          {improvements.map((improvement, index) => (
            <li
              key={`${index}-${improvement}`}
              className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-sm leading-relaxed text-slate-200"
            >
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-indigo/15 text-xs font-semibold tabular-nums text-brand-indigo">
                {index + 1}
              </span>
              <span>{improvement}</span>
            </li>
          ))}
        </ol>
      </div>
    </Card>
  );
}
