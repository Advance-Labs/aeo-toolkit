import type { JSX } from 'react';
import type { Score } from '@aeo/types';

const SIZE = 120;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Map a 0–100 score to a traffic-light color. */
function scoreColor(score: number): string {
  if (score >= 80) return '#16a34a'; // green
  if (score >= 60) return '#d97706'; // amber
  return '#dc2626'; // red
}

export interface ScoreGaugeProps {
  score: Score;
}

/** Circular SVG gauge showing the overall 0–100 AI-readiness score + grade. */
export function ScoreGauge({ score }: ScoreGaugeProps): JSX.Element {
  const clamped = Math.max(0, Math.min(100, score.overall));
  const dash = (clamped / 100) * CIRCUMFERENCE;
  const color = scoreColor(clamped);

  return (
    <div className="gauge">
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
          stroke="#e5e7eb"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
        <text x="50%" y="46%" textAnchor="middle" className="gauge-score" fill={color}>
          {clamped}
        </text>
        <text x="50%" y="66%" textAnchor="middle" className="gauge-grade">
          Grade {score.grade}
        </text>
      </svg>
      <div className="gauge-meta">
        <span className="pass">{score.passedCount} passed</span>
        <span className="fail">{score.failedCount} failed</span>
        {score.criticalCount > 0 && <span className="crit">{score.criticalCount} critical</span>}
      </div>
    </div>
  );
}
