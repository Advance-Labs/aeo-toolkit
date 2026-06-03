import { describe, expect, it } from 'vitest';
import { lastNDays, subtractDays, toIsoDate } from './dates.js';

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
