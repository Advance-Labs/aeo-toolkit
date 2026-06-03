import type { JSX } from 'react';

export interface ImprovementsListProps {
  improvements: string[];
}

/**
 * The ordered list of recommended improvements (recommendations of every absent
 * signal, heaviest-weight first — as produced by `eeatScore`).
 */
export function ImprovementsList({ improvements }: ImprovementsListProps): JSX.Element {
  if (improvements.length === 0) {
    return (
      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <h2 className="text-base font-semibold text-emerald-800">No improvements needed</h2>
        <p className="mt-1 text-sm text-emerald-700">
          Every E-E-A-T signal we check for is present. Nice work.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">
        Recommended improvements ({improvements.length})
      </h2>
      <ol className="mt-3 flex flex-col gap-2">
        {improvements.map((improvement, index) => (
          <li
            key={`${index}-${improvement}`}
            className="flex gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"
          >
            <span className="font-semibold text-slate-400 tabular-nums">{index + 1}.</span>
            <span>{improvement}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
