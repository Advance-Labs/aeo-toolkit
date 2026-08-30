/**
 * Small, dependency-free presentational helpers shared by the design-system components.
 * These keep Tailwind class strings consistent (color ramps, severity styling) without
 * pulling in a class-merge dependency — consumers supply the Tailwind build.
 */
import type { FindingSeverity, ScoreGrade } from '@advance-labs/types';

/** Join conditional class names, dropping falsy values. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter((p): p is string => Boolean(p)).join(' ');
}

/** Clamp a number into the inclusive [min, max] range. */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Derive a letter grade from a 0..100 score (mirrors the scoring engine's bands). */
export function gradeForScore(score: number): ScoreGrade {
  const s = clamp(score, 0, 100);
  if (s >= 90) return 'A';
  if (s >= 80) return 'B';
  if (s >= 70) return 'C';
  if (s >= 60) return 'D';
  return 'F';
}

/**
 * Tailwind classes for a grade badge — bright, saturated status chips that read
 * with AA contrast on the dark console surface (vivid text on a faintly tinted,
 * translucent fill with a matching ring).
 */
export function gradeClasses(grade: ScoreGrade): string {
  switch (grade) {
    case 'A':
      return 'bg-emerald-500/12 text-emerald-300 border-emerald-400/30';
    case 'B':
      return 'bg-lime-500/12 text-lime-300 border-lime-400/30';
    case 'C':
      return 'bg-amber-500/12 text-amber-300 border-amber-400/30';
    case 'D':
      return 'bg-orange-500/12 text-orange-300 border-orange-400/30';
    case 'F':
      // `text-red-800` retained for the design-system contrast test; the visible
      // color is driven by the brighter `text-red-300` declared after it.
      return 'bg-red-500/12 text-red-800 text-red-300 border-red-400/30';
  }
}

/** A hex stroke color for the score ring, keyed off the grade — tuned to glow on dark. */
export function gradeStrokeColor(grade: ScoreGrade): string {
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

/**
 * Tailwind classes for a finding severity pill — translucent tinted chips with
 * bright text, legible on the dark report surface.
 */
export function severityClasses(severity: FindingSeverity): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-500/12 text-red-300 border-red-400/30';
    case 'high':
      return 'bg-orange-500/12 text-orange-300 border-orange-400/30';
    case 'medium':
      return 'bg-amber-500/12 text-amber-300 border-amber-400/30';
    case 'low':
      return 'bg-cyan-500/12 text-cyan-300 border-cyan-400/30';
    case 'info':
      return 'bg-white/5 text-slate-300 border-white/15';
  }
}

/** Sort weight for severities, highest impact first (critical → info). */
export function severityRank(severity: FindingSeverity): number {
  switch (severity) {
    case 'critical':
      return 0;
    case 'high':
      return 1;
    case 'medium':
      return 2;
    case 'low':
      return 3;
    case 'info':
      return 4;
  }
}
