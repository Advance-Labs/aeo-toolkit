import type { JSX } from 'react';
import type { ScoreCategory } from '@advance-labs/types';
import { clamp, gradeColor, gradeForScore } from './scoreHelpers';

export function CategoryBars({ categories }: { categories: ScoreCategory[] }): JSX.Element {
  if (categories.length === 0) {
    return <p className="text-sm text-slate-400">No category data available.</p>;
  }
  return (
    <ul className="flex flex-col gap-4" aria-label="Score breakdown by category">
      {categories.map((category) => {
        const pct = clamp(Math.round(category.score), 0, 100);
        const color = gradeColor(gradeForScore(category.score));
        const total = category.passedCount + category.failedCount;
        return (
          <li key={category.key} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-slate-200">{category.label}</span>
              <span className="text-sm tabular-nums text-slate-300">
                {pct}
                <span className="text-slate-400">
                  {' '}
                  · {category.passedCount}/{total}
                </span>
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-white/[0.07]"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${category.label} score`}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  backgroundColor: color,
                  boxShadow: `0 0 10px ${color}55`,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
