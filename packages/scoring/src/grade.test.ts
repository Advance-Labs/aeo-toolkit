import { describe, expect, it } from 'vitest';
import { clampScore, scoreToGrade } from './grade.js';

describe('scoreToGrade', () => {
  it('maps the canonical thresholds', () => {
    expect(scoreToGrade(100)).toBe('A');
    expect(scoreToGrade(90)).toBe('A');
    expect(scoreToGrade(89.9)).toBe('B');
    expect(scoreToGrade(80)).toBe('B');
    expect(scoreToGrade(70)).toBe('C');
    expect(scoreToGrade(60)).toBe('D');
    expect(scoreToGrade(59.9)).toBe('F');
    expect(scoreToGrade(0)).toBe('F');
  });

  it('clamps out-of-range and NaN inputs', () => {
    expect(scoreToGrade(120)).toBe('A');
    expect(scoreToGrade(-5)).toBe('F');
    expect(scoreToGrade(Number.NaN)).toBe('F');
  });
});

describe('clampScore', () => {
  it('clamps to the 0..100 range', () => {
    expect(clampScore(50)).toBe(50);
    expect(clampScore(150)).toBe(100);
    expect(clampScore(-10)).toBe(0);
    expect(clampScore(Number.NaN)).toBe(0);
  });
});
