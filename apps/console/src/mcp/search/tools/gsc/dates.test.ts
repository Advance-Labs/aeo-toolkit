import { describe, expect, it } from 'vitest';
import { lastNDays, precedingWindow, rangeLengthDays, subtractDays, toIsoDate } from './dates.js';

describe('toIsoDate', () => {
  it('formats a UTC date as YYYY-MM-DD with zero padding', () => {
    expect(toIsoDate(new Date(Date.UTC(2024, 0, 5)))).toBe('2024-01-05');
  });
});

describe('subtractDays', () => {
  it('subtracts whole days in UTC', () => {
    expect(toIsoDate(subtractDays(new Date(Date.UTC(2024, 2, 1)), 1))).toBe('2024-02-29');
  });
});

describe('lastNDays', () => {
  it('ends lagDays before today and spans N days inclusive', () => {
    const today = new Date(Date.UTC(2024, 5, 20)); // 2024-06-20
    const range = lastNDays(7, { today, lagDays: 2 });
    // end = 2024-06-18, start = end - 6 = 2024-06-12
    expect(range.endDate).toBe('2024-06-18');
    expect(range.startDate).toBe('2024-06-12');
  });

  it('uses the default 2-day lag', () => {
    const today = new Date(Date.UTC(2024, 5, 20));
    const range = lastNDays(1, { today });
    expect(range.endDate).toBe('2024-06-18');
    expect(range.startDate).toBe('2024-06-18');
  });
});

describe('rangeLengthDays', () => {
  it('counts both endpoints', () => {
    expect(rangeLengthDays({ startDate: '2026-03-01', endDate: '2026-03-28' })).toBe(28);
    expect(rangeLengthDays({ startDate: '2026-03-01', endDate: '2026-03-01' })).toBe(1);
  });
});

describe('precedingWindow', () => {
  it('returns an equal-length window ending the day before, with no overlap', () => {
    expect(precedingWindow({ startDate: '2026-03-01', endDate: '2026-03-28' })).toEqual({
      startDate: '2026-02-01',
      endDate: '2026-02-28',
    });
  });

  it('crosses a year boundary correctly', () => {
    expect(precedingWindow({ startDate: '2026-01-08', endDate: '2026-01-14' })).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-01-07',
    });
  });
});
