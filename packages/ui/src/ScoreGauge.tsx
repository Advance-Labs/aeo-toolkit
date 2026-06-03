import type { JSX } from 'react';
import type { Score } from '@aeo/types';
import { GradeBadge } from './GradeBadge.js';
import { clamp, cx, gradeStrokeColor } from './utils.js';

export interface ScoreGaugeProps {
  score: Score;
  /** Diameter of the SVG ring in pixels. Defaults to 160. */
  size?: number;
  /** Stroke thickness of the ring in pixels. Defaults to 12. */
  strokeWidth?: number;
  /** Extra Tailwind classes appended to the wrapper. */
  className?: string;
}

/**
 * Circular score gauge: an SVG progress ring around the numeric 0–100 score,
 * with the letter grade rendered alongside. Presentational only — the colored
 * arc length is derived from `score.overall`.
 */
export function ScoreGauge({
  score,
  size = 160,
  strokeWidth = 12,
  className,
}: ScoreGaugeProps): JSX.Element {
  const overall = clamp(Math.round(score.overall), 0, 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - overall / 100);
  const stroke = gradeStrokeColor(score.grade);
  const center = size / 2;

  return (
    <figure
      className={cx('inline-flex flex-col items-center gap-3', className)}
      role="img"
      aria-label={`Overall score ${overall} out of 100, grade ${score.grade}`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-slate-200"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold tabular-nums text-slate-900">{overall}</span>
          <span className="text-xs uppercase tracking-wide text-slate-500">/ 100</span>
        </div>
      </div>
      <figcaption className="flex items-center gap-2">
        <GradeBadge grade={score.grade} size="md" />
        <span className="text-sm text-slate-600">
          {score.passedCount} passed · {score.failedCount} failed
          {score.criticalCount > 0 ? ` · ${score.criticalCount} critical` : ''}
        </span>
      </figcaption>
    </figure>
  );
}
