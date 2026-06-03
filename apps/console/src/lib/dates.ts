/**
 * Date-window helpers for GA4 / GSC requests. Pure and deterministic given an injected `now`.
 *
 * GA4 accepts `YYYY-MM-DD`; GSC accepts the same. We default to a trailing 28-day window, which is
 * a sensible SEO reporting period and within GSC's freshness limits.
 */

export interface DateWindow {
  startDate: string;
  endDate: string;
}

/** Format a Date as `YYYY-MM-DD` in UTC. */
export function toIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * A trailing window ending today (UTC). `days` is the inclusive span length; default 28.
 * GSC data lags ~2–3 days, so the most recent rows may be partial — acceptable for chat grounding.
 */
export function trailingWindow(days = 28, now: Date = new Date()): DateWindow {
  const end = new Date(now);
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { startDate: toIsoDate(start), endDate: toIsoDate(end) };
}
