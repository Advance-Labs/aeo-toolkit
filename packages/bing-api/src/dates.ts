/**
 * WCF / ASP.NET AJAX date serialization, used by the Bing Webmaster JSON API.
 *
 * Bing emits `/Date(1399100400000-0700)/` rather than ISO 8601. The millisecond
 * value is ALREADY UTC; the trailing offset records the timezone the value was
 * rendered in and carries no information we need. Adding it produces a date that
 * is wrong by hours while still looking entirely plausible — which is why this
 * module throws rather than ever falling back to `new Date(raw)`.
 */

/** Thrown when a value is not a well-formed WCF date. Never silently coerced. */
export class WcfDateError extends Error {
  readonly raw: string;

  constructor(raw: string, reason: string) {
    super(`Not a valid WCF date (${reason}): ${JSON.stringify(raw)}`);
    this.name = 'WcfDateError';
    this.raw = raw;
    Object.setPrototypeOf(this, WcfDateError.prototype);
  }
}

/** `/Date(<signed ms>[<+|-><4-digit offset>])/` — the offset group is discarded. */
const WCF_DATE = /^\/Date\((-?\d+)(?:[+-]\d{4})?\)\/$/;

/**
 * Parse a WCF date string into a `Date`.
 *
 * @throws {WcfDateError} on any input that is not exactly the WCF shape, and on a
 *   millisecond value that does not produce a valid `Date`.
 */
export function parseWcfDate(raw: string): Date {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new WcfDateError(String(raw), 'not a non-empty string');
  }

  const match = WCF_DATE.exec(raw);
  if (match === null) {
    throw new WcfDateError(raw, 'does not match /Date(ms[±hhmm])/');
  }

  const ms = Number(match[1]);
  if (!Number.isFinite(ms)) {
    throw new WcfDateError(raw, 'millisecond value is not finite');
  }

  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) {
    throw new WcfDateError(raw, 'millisecond value is out of Date range');
  }
  return date;
}

/** Serialize a `Date` back to the WCF shape (no offset suffix — the value is UTC). */
export function toWcfDate(value: Date): string {
  const ms = value.getTime();
  if (Number.isNaN(ms)) {
    throw new WcfDateError(String(value), 'Invalid Date');
  }
  return `/Date(${ms})/`;
}
