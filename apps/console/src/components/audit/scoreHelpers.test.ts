import { describe, expect, it } from 'vitest';
import { clamp, gradeColor, gradeForScore } from './scoreHelpers';

describe('audit score helpers', () => {
  it('clamps values to the provided range and maps NaN to the minimum', () => {
    expect(clamp(-1, 0, 100)).toBe(0);
    expect(clamp(101, 0, 100)).toBe(100);
    expect(clamp(Number.NaN, 0, 100)).toBe(0);
  });

  it('maps score thresholds to grades', () => {
    expect([59, 60, 70, 80, 90].map(gradeForScore)).toEqual(['F', 'D', 'C', 'B', 'A']);
  });

  it('returns the existing dark-theme color for each grade', () => {
    expect(['A', 'B', 'C', 'D', 'F'].map((grade) => gradeColor(grade as 'A' | 'B' | 'C' | 'D' | 'F'))).toEqual([
      '#34d399',
      '#a3e635',
      '#fbbf24',
      '#fb923c',
      '#f87171',
    ]);
  });
});
