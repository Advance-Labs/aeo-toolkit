/**
 * Cadence core — the pure scheduling brain of the autopilot.
 *
 * Given a customer's monthly {@link CadenceTarget} and the set of job dedupe-keys already recorded
 * for a calendar period, {@link dueJobs} decides which {@link JobKind}s still need to run. The
 * dedupe key `customerId:jobKind:period` makes re-running a period a no-op (idempotency): once a
 * job's key is present, that job is no longer due.
 *
 * Everything here is pure — no clock, no I/O. Callers pass the period in (derive it from an injected
 * clock with {@link periodOf}), so the logic is exhaustively unit-testable.
 */
import type { CustomerProfile, JobKind } from '@advance-labs/types';

/** A job that is due to run for one customer in one period. */
export interface DueJob {
  jobKind: JobKind;
  /** Calendar period the job covers, e.g. `'2026-06'`. */
  period: string;
  /** Idempotency key `customerId:jobKind:period`; absence from the store means the job is due. */
  dedupeKey: string;
  /** How many proposals this job should aim to produce (the customer's monthly target). */
  target: number;
}

/** Format a Date as a `YYYY-MM` calendar period (UTC) — the idempotency window. */
export function periodOf(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/** The stable idempotency key for one (customer, jobKind, period) triple. */
export function dedupeKey(customerId: string, jobKind: JobKind, period: string): string {
  return `${customerId}:${jobKind}:${period}`;
}

/** Map a customer's cadence targets to the job kinds that are in-cadence (target > 0). */
export function inCadenceKinds(profile: CustomerProfile): Array<{ jobKind: JobKind; target: number }> {
  const candidates: Array<{ jobKind: JobKind; target: number }> = [
    { jobKind: 'content.generate', target: profile.cadence.articlesPerMonth },
    { jobKind: 'link.outreach', target: profile.cadence.outreachPlacementsPerMonth },
  ];
  return candidates.filter((c) => c.target > 0);
}

/**
 * Which jobs are due for `profile` in `period`, given the dedupe keys already recorded this period.
 *
 * A job is due when its monthly target is positive AND its dedupe key is not already present.
 * Re-running with the same `existingKeys` yields an empty list — the idempotency guarantee.
 */
export function dueJobs(
  profile: CustomerProfile,
  period: string,
  existingKeys: ReadonlySet<string>,
): DueJob[] {
  const jobs: DueJob[] = [];
  for (const { jobKind, target } of inCadenceKinds(profile)) {
    const key = dedupeKey(profile.id, jobKind, period);
    if (existingKeys.has(key)) continue;
    jobs.push({ jobKind, period, dedupeKey: key, target });
  }
  return jobs;
}
