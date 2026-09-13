import type { JSX } from 'react';
import type { Score } from '@advance-labs/types';

const SIZE = 120;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Map a 0-100 score to a result BAND, not to a colour.
 *
 * This used to return a hex literal, which put brand colours in a TSX file as well as the
 * stylesheet and made the popup impossible to retheme from one place. The band is the thing
 * the component actually knows about; what a band looks like is the stylesheet's business.
 * See `brand/README.md`: OK and Warn are reserved for audit results.
 */
function scoreBand(score: number): 'ok' | 'warn' | 'bad' {
  if (score >= 80) return 'ok';
  if (score >= 60) return 'warn';
  return 'bad';
}

export interface ScoreGaugeProps {
  score: Score;
}

/** Circular SVG gauge showing the overall 0–100 AI-readiness score + grade. */
export function ScoreGauge({ score }: ScoreGaugeProps): JSX.Element {
  const clamped = Math.max(0, Math.min(100, score.overall));
  const dash = (clamped / 100) * CIRCUMFERENCE;
  const band = scoreBand(clamped);

  return (
    <div className={`gauge gauge-${band}`}>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`AI-readiness score ${clamped} out of 100, grade ${score.grade}`}
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          className="gauge-track"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          className="gauge-arc"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
        <text x="50%" y="46%" textAnchor="middle" className="gauge-score">
          {clamped}
        </text>
        <text x="50%" y="66%" textAnchor="middle" className="gauge-grade">
          Grade {score.grade}
        </text>
      </svg>
      <div className="gauge-meta">
        <span className="pass">{score.passedCount} passed</span>
        <span className="fail">{score.failedCount} failed</span>
        {/*
          ADV-175: `criticalCount` counts severity `critical` AND `high` (engine.ts), so
          labelling it "critical" overstated a high-severity finding. The tally is right;
          the word was not.
        */}
        {score.criticalCount > 0 && (
          <span className="crit">{score.criticalCount} needs attention</span>
        )}
      </div>
    </div>
  );
}
