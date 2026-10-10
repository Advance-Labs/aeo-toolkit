import type { ScoreGrade } from '@advance-labs/types';

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function gradeForScore(score: number): ScoreGrade {
  const s = clamp(score, 0, 100);
  if (s >= 90) return 'A';
  if (s >= 80) return 'B';
  if (s >= 70) return 'C';
  if (s >= 60) return 'D';
  return 'F';
}

/** Hex stroke/fill color for a grade — tuned to glow on dark. */
export function gradeColor(grade: ScoreGrade): string {
  switch (grade) {
    case 'A':
      return '#34d399';
    case 'B':
      return '#a3e635';
    case 'C':
      return '#fbbf24';
    case 'D':
      return '#fb923c';
    case 'F':
      return '#f87171';
  }
}
