import type { FindingSeverity } from '@advance-labs/types';
import { describe, expect, it } from 'vitest';
import { severityChipClasses, severityRank } from './findingHelpers';

const rankCases: Array<[FindingSeverity, number]> = [
  ['critical', 0],
  ['high', 1],
  ['medium', 2],
  ['low', 3],
  ['info', 4],
];

const chipClassCases: Array<[FindingSeverity, string]> = [
  ['critical', 'bg-red-500/12 text-red-300 border-red-400/30'],
  ['high', 'bg-orange-500/12 text-orange-300 border-orange-400/30'],
  ['medium', 'bg-amber-500/12 text-amber-300 border-amber-400/30'],
  ['low', 'bg-cyan-500/12 text-cyan-300 border-cyan-400/30'],
  ['info', 'bg-white/5 text-slate-300 border-white/15'],
];

describe('severityRank', () => {
  it.each(rankCases)('ranks %s as %i', (severity, expected) => {
    expect(severityRank(severity)).toBe(expected);
  });
});

describe('severityChipClasses', () => {
  it.each(chipClassCases)('returns the existing classes for %s', (severity, expected) => {
    expect(severityChipClasses(severity)).toBe(expected);
  });
});
