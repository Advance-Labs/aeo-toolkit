/**
 * Smart scheduler agent — queues edited posts onto publish dates with a ramp.
 *
 * Strategy: never publish two posts on the same day; ramp out from a start date at a fixed
 * cadence; order by opportunity score so the highest-value posts go out first. Pure: takes posts +
 * a clock, returns posts with `scheduledFor` set. No I/O.
 */
import type { Post } from '../types.js';

export interface ScheduleInput {
  /** Posts to schedule (typically status `edited`). */
  posts: Post[];
  /** Days between consecutive publishes. */
  cadenceDays: number;
  /** First available publish date (inclusive). Defaults to tomorrow. */
  startDate?: string;
  /** Already-occupied publish dates (YYYY-MM-DD) to skip. */
  occupiedDates?: string[];
  /** Opportunity score per slug, used to order the queue (higher first). */
  opportunityBySlug?: Record<string, number>;
}

const MS_PER_DAY = 86_400_000;

/** Format a Date as a UTC YYYY-MM-DD string. */
export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Add whole days to a YYYY-MM-DD date, returning a YYYY-MM-DD string (UTC). */
export function addDays(isoDate: string, days: number): string {
  const base = new Date(`${isoDate}T00:00:00.000Z`).getTime();
  return toIsoDate(new Date(base + days * MS_PER_DAY));
}

/**
 * Assign publish dates. `now` is injected for deterministic tests. Returns a new array; inputs are
 * not mutated. Posts are ordered by opportunity score (desc), then slug for stable tie-breaks.
 */
export function runScheduler(input: ScheduleInput, now: () => Date = () => new Date()): Post[] {
  const cadence = Math.max(1, Math.floor(input.cadenceDays));
  const start = input.startDate ?? addDays(toIsoDate(now()), 1);
  const occupied = new Set(input.occupiedDates ?? []);
  const scores = input.opportunityBySlug ?? {};

  const ordered = [...input.posts].sort((a, b) => {
    const sa = scores[a.slug] ?? 0;
    const sb = scores[b.slug] ?? 0;
    if (sb !== sa) return sb - sa;
    return a.slug.localeCompare(b.slug);
  });

  const result: Post[] = [];
  let cursor = start;
  for (const post of ordered) {
    while (occupied.has(cursor)) cursor = addDays(cursor, cadence);
    occupied.add(cursor);
    result.push({
      ...post,
      status: 'scheduled',
      scheduledFor: cursor,
      updatedAt: now().toISOString(),
    });
    cursor = addDays(cursor, cadence);
  }
  return result;
}

/** Posts whose `scheduledFor` is on or before `asOf` (default: today) and not yet published. */
export function duePosts(posts: Post[], asOf: string): Post[] {
  return posts.filter(
    (p) => p.status === 'scheduled' && p.scheduledFor !== undefined && p.scheduledFor <= asOf,
  );
}
