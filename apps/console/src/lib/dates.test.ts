import { describe, expect, it } from 'vitest';
import { toIsoDate, trailingWindow } from './dates.js';

describe('toIsoDate', () => {
  it('formats a UTC date as YYYY-MM-DD', () => {
    expect(toIsoDate(new Date('2024-03-07T12:00:00Z'))).toBe('2024-03-07');
  });
});

describe('trailingWindow', () => {
  it('produces an inclusive N-day window ending at now', () => {
    const now = new Date('2024-01-28T00:00:00Z');
    const window = trailingWindow(28, now);
    expect(window.endDate).toBe('2024-01-28');
    expect(window.startDate).toBe('2024-01-01');
  });

  it('defaults to a 28-day span', () => {
    const now = new Date('2024-02-29T00:00:00Z');
    const window = trailingWindow(undefined, now);
    expect(window.endDate).toBe('2024-02-29');
    expect(window.startDate).toBe('2024-02-02');
  });
});
