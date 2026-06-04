import type { JSX } from 'react';
import type { ScoreCategory } from '@aeo/types';
import { clamp, cx, gradeForScore, gradeStrokeColor } from './utils.js';

export interface CategoryBreakdownProps {
  categories: ScoreCategory[];
  /** Extra Tailwind classes appended to the list wrapper. */
  className?: string;
}

/**
 * A list of per-category score bars (crawlability, metadata, AEO, …).
 * Each row shows the category label, its 0–100 score as a colored bar, and
 * pass/fail counts. Presentational only.
 */
export function CategoryBreakdown({ categories, className }: CategoryBreakdownProps): JSX.Element {
  if (categories.length === 0) {
    return <p className={cx('text-sm text-slate-400', className)}>No category data available.</p>;
  }

  return (
    <ul className={cx('flex flex-col gap-5', className)} aria-label="Score breakdown by category">
      {categories.map((category) => {
        const pct = clamp(Math.round(category.score), 0, 100);
        const color = gradeStrokeColor(gradeForScore(category.score));
        return (
          <li key={category.key} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-white">{category.label}</span>
              <span className="text-sm tabular-nums text-slate-300">
                <span className="font-semibold text-white">{pct}</span>
                <span className="text-slate-500">
                  {' '}
                  · {category.passedCount}/{category.passedCount + category.failedCount} passed
                </span>
              </span>
            </div>
            <div
              className="h-2.5 w-full overflow-hidden rounded-full bg-white/5 ring-1 ring-inset ring-white/10"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${category.label} score`}
            >
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${pct}%`,
                  backgroundImage: `linear-gradient(90deg, #6366F1, ${color})`,
                  boxShadow: `0 0 12px ${color}66`,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
