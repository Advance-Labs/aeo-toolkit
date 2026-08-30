import type { JSX } from 'react';
import type { ScoreGrade } from '@advance-labs/types';
import { cx, gradeClasses } from './utils.js';

export interface GradeBadgeProps {
  grade: ScoreGrade;
  /** Visual size. Defaults to `md`. */
  size?: 'sm' | 'md' | 'lg';
  /** Extra Tailwind classes appended to the badge. */
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<GradeBadgeProps['size']>, string> = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-12 w-12 text-lg',
};

/**
 * A compact letter-grade pill (A–F) with severity-appropriate coloring.
 * Purely presentational — accepts a `ScoreGrade` from the scoring engine.
 */
export function GradeBadge({ grade, size = 'md', className }: GradeBadgeProps): JSX.Element {
  return (
    <span
      role="status"
      aria-label={`Grade ${grade}`}
      className={cx(
        'inline-flex items-center justify-center rounded-full border font-bold backdrop-blur-sm',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
        SIZE_CLASSES[size],
        gradeClasses(grade),
        className,
      )}
    >
      {grade}
    </span>
  );
}
