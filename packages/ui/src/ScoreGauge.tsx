import type { JSX } from 'react';
import type { Score } from '@advance-labs/types';
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
  // Per-instance gradient/filter ids so multiple gauges on one page never collide.
  const gradId = `aeo-gauge-grad-${score.grade}-${size}`;
  const glowId = `aeo-gauge-glow-${score.grade}-${size}`;

  return (
    <figure
      className={cx('inline-flex flex-col items-center gap-4', className)}
      role="img"
      aria-label={`Overall score ${overall} out of 100, grade ${score.grade}`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        {/* Soft brand halo behind the ring. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full opacity-60 blur-2xl"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${stroke}40, transparent 70%)`,
          }}
        />
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="relative -rotate-90"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#6366F1" />
              <stop offset="0.5" stopColor="#8B5CF6" />
              <stop offset="1" stopColor={stroke} />
            </linearGradient>
            <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={stroke} floodOpacity="0.7" />
            </filter>
          </defs>
          {/* Track. */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-white/8"
            strokeWidth={strokeWidth}
          />
          {/* Progress arc with a brand gradient + glow. */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            filter={`url(#${glowId})`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-bold tabular-nums text-white">{overall}</span>
          <span className="mt-0.5 text-xs font-medium uppercase tracking-widest text-slate-400">
            / 100
          </span>
        </div>
      </div>
      <figcaption className="flex flex-wrap items-center justify-center gap-2.5 text-center">
        <GradeBadge grade={score.grade} size="md" />
        <span className="text-sm text-slate-400">
          <span className="font-semibold text-emerald-300">{score.passedCount}</span> passed
          {' · '}
          <span className="font-semibold text-slate-300">{score.failedCount}</span> failed
          {score.criticalCount > 0 ? (
            <>
              {' · '}
              <span className="font-semibold text-red-300">{score.criticalCount}</span> critical
            </>
          ) : null}
        </span>
      </figcaption>
    </figure>
  );
}
