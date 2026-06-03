/**
 * Small, dependency-free presentational helpers shared by the design-system components.
 * These keep Tailwind class strings consistent (color ramps, severity styling) without
 * pulling in a class-merge dependency — consumers supply the Tailwind build.
 */
import type { FindingSeverity, ScoreGrade } from '@aeo/types';

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

/** Tailwind text/border/background classes for a grade badge. */
export function gradeClasses(grade: ScoreGrade): string {
  switch (grade) {
    case 'A':
      return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    case 'B':
      return 'bg-lime-100 text-lime-800 border-lime-300';
    case 'C':
      return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'D':
      return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'F':
      return 'bg-red-100 text-red-800 border-red-300';
  }
}

/** A hex stroke color for the score ring, keyed off the grade. */
export function gradeStrokeColor(grade: ScoreGrade): string {
  switch (grade) {
    case 'A':
      return '#059669';
    case 'B':
      return '#65a30d';
    case 'C':
      return '#d97706';
    case 'D':
      return '#ea580c';
    case 'F':
      return '#dc2626';
  }
}

/** Tailwind classes + human label for a finding severity pill. */
export function severityClasses(severity: FindingSeverity): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'high':
      return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'medium':
      return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'low':
      return 'bg-sky-100 text-sky-800 border-sky-300';
    case 'info':
      return 'bg-slate-100 text-slate-700 border-slate-300';
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
