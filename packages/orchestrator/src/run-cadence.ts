/**
 * runCadence — ties the autopilot together for one customer, one pass.
 *
 * For the current calendar period it: derives the due jobs from the customer's cadence and what the
 * store already recorded (idempotent), runs the matching runner (content or outreach), persists the
 * produced proposals under the job's dedupe key, and returns a {@link JobResult} per in-cadence kind.
 *
 * All I/O is injected (store, clock, runners), so a full pass runs offline with a fake clock. Jobs
 * are hard-scoped to one `customer_id` (security invariant 2 / C2): the runners only ever receive
 * `profile`, and proposals are written with the profile's own `ownerId`.
 *
 * It does NOT execute/publish: every proposal is written `pending`. Whether a content proposal may
 * later auto-publish is decided by {@link shouldAutoExecute} in the console execution layer.
 */
import type { CustomerProfile, JobResult } from '@aeo/types';
import type { ProposalStore } from './proposal-store.js';
import type { ContentRunner } from './content-runner.js';
import type { OutreachRunner } from './outreach-runner.js';
import { dueJobs, inCadenceKinds, periodOf } from './cadence.js';

export interface OrchestratorDeps {
  store: ProposalStore;
  /** Injected clock for deterministic periods/timestamps. */
  clock: () => Date;
  content: ContentRunner;
  outreach: OutreachRunner;
  /** GSC lookback window (days) handed to the content runner. Default 28. */
  lookbackDays?: number;
}

const MS_PER_DAY = 86_400_000;
const DEFAULT_LOOKBACK_DAYS = 28;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const ALREADY_RAN = 'already-ran-this-period';

/** Run one cadence pass for `profile`. Returns a {@link JobResult} per in-cadence job kind. */
export async function runCadence(
  profile: CustomerProfile,
  deps: OrchestratorDeps,
): Promise<JobResult[]> {
  const now = deps.clock();
  const period = periodOf(now);
  const endDate = isoDate(now);
  const lookback = deps.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const startDate = isoDate(new Date(now.getTime() - lookback * MS_PER_DAY));

  const existingKeys = await deps.store.jobKeysForPeriod(profile.id, period);
  const due = dueJobs(profile, period, existingKeys);
  const dueByKind = new Map(due.map((j) => [j.jobKind, j]));

  const results: JobResult[] = [];
  for (const { jobKind } of inCadenceKinds(profile)) {
    const job = dueByKind.get(jobKind);
    if (job === undefined) {
      // In cadence but already run this period — idempotent skip.
      results.push({
        jobKind,
        customerId: profile.id,
        period,
        proposalsCreated: 0,
        skipped: true,
        reason: ALREADY_RAN,
      });
      continue;
    }

    const proposals =
      jobKind === 'content.generate'
        ? await deps.content.run({ profile, period, limit: job.target, startDate, endDate })
        : await deps.outreach.run({ profile, period, limit: job.target });

    const { created } = await deps.store.createForJob(job.dedupeKey, proposals);
    const result: JobResult = {
      jobKind,
      customerId: profile.id,
      period,
      proposalsCreated: created ? proposals.length : 0,
      skipped: !created,
    };
    if (!created) result.reason = ALREADY_RAN;
    results.push(result);
  }

  return results;
}
