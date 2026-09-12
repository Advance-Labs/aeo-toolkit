/**
 * Pure date helpers for the GSC convenience tools (`gsc_top_queries`,
 * `gsc_ctr_gaps`). GSC data lags ~2 days, so a "last N days" window ends a couple
 * of days before today by default. Time is injectable for deterministic tests.
 */
import type { DateRange } from '@advance-labs/types';

/** GSC freshness lag: data for the most recent ~2 days is typically incomplete. */
export const GSC_DATA_LAG_DAYS = 2;

/** Format a `Date` as a UTC `YYYY-MM-DD` string (the format GA4 + GSC expect). */
export function toIsoDate(date: Date): string {
  const yyyy = date.getUTCFullYear().toString().padStart(4, '0');
  const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = date.getUTCDate().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Subtract `days` whole days from a date (UTC), returning a new `Date`. */
export function subtractDays(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() - days);
  return copy;
}

/**
 * Build a `{ startDate, endDate }` window covering the last `days` days, ending
 * `lagDays` before `today` (default: today = now, lag = {@link GSC_DATA_LAG_DAYS}).
 */
export function lastNDays(days: number, opts: { today?: Date; lagDays?: number } = {}): DateRange {
  const today = opts.today ?? new Date();
  const lagDays = opts.lagDays ?? GSC_DATA_LAG_DAYS;
  const end = subtractDays(today, lagDays);
  const start = subtractDays(end, Math.max(0, days - 1));
  return { startDate: toIsoDate(start), endDate: toIsoDate(end) };
}

/** Whole days spanned by a range, inclusive of both endpoints (min 1). */
export function rangeLengthDays(range: DateRange): number {
  const start = new Date(`${range.startDate}T00:00:00Z`).getTime();
  const end = new Date(`${range.endDate}T00:00:00Z`).getTime();
  const days = Math.round((end - start) / 86_400_000) + 1;
  return Math.max(1, days);
}

/**
 * The window of equal length ending the day before `range` starts.
 *
 * Used to build a like-for-like baseline for decay detection: comparing the last 28
 * days against the 28 before it, with no gap and no overlap. An overlap would damp
 * the very decline the comparison is meant to detect.
 */
export function precedingWindow(range: DateRange): DateRange {
  const length = rangeLengthDays(range);
  const end = subtractDays(new Date(`${range.startDate}T00:00:00Z`), 1);
  const start = subtractDays(end, length - 1);
  return { startDate: toIsoDate(start), endDate: toIsoDate(end) };
}
