import type { ScoreGrade } from '@aeo/types';

/**
 * Map a 0..100 numeric score to a letter grade.
 *
 * Thresholds follow the conventional academic scale used across the toolkit's
 * reports: >=90 A, >=80 B, >=70 C, >=60 D, else F. Inputs are clamped so that
 * out-of-range numbers (e.g. floating-point drift slightly above 100) still map
 * sensibly rather than throwing.
 */
export function scoreToGrade(n: number): ScoreGrade {
  const clamped = clampScore(n);
  if (clamped >= 90) return 'A';
  if (clamped >= 80) return 'B';
  if (clamped >= 70) return 'C';
  if (clamped >= 60) return 'D';
  return 'F';
}

/** Clamp an arbitrary number into the 0..100 score range. NaN becomes 0. */
export function clampScore(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}
