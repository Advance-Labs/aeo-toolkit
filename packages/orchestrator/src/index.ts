/**
 * @advance-labs/orchestrator — the spine of the Autopilot v1 managed layer.
 *
 * Composes the existing reuse layer into a per-customer "done-for-you" cadence that produces
 * reviewable proposals (never silent side effects):
 *
 *   - Cadence core (pure): {@link dueJobs} / {@link periodOf} / {@link dedupeKey} — idempotent on
 *     `customerId:jobKind:period`.
 *   - {@link ProposalStore}: idempotent-create proposal persistence ({@link InMemoryProposalStore} +
 *     {@link SupabaseProposalStore}).
 *   - {@link ContentRunner}: composes `@advance-labs/blogging` sub-agents (research → write → edit), stops
 *     before publish, emits a {@link ContentProposal}.
 *   - {@link OutreachRunner}: `@advance-labs/backlinks` discovery + contact extraction over SSRF-guarded
 *     `@advance-labs/net-guard` fetches, emits {@link LinkOutreachProposal}s (always human-gated).
 *   - {@link shouldAutoExecute}: the graduated-autonomy gate (content above a threshold only).
 *   - {@link runCadence}: ties it together for one customer/pass.
 *
 * Every seam (network/clock/storage/LLM/ids) is injected, so the whole package is offline-testable.
 * It depends only on the reuse layer + `@advance-labs/types`; it must NOT import from `apps/console`.
 */

// Cadence core (pure)
export { dueJobs, periodOf, dedupeKey, inCadenceKinds } from './cadence.js';
export type { DueJob } from './cadence.js';

// Graduated-autonomy gate (pure)
export { shouldAutoExecute, DEFAULT_AUTONOMY_POLICY } from './autonomy.js';
export type { AutonomyPolicy } from './autonomy.js';

// Proposal store
export {
  InMemoryProposalStore,
  SupabaseProposalStore,
  ProposalStoreError,
  getProposalStore,
  proposalToRow,
  rowToProposal,
} from './proposal-store.js';
export type {
  ProposalStore,
  ProposalStatusPatch,
  CreateForJobResult,
  SupabaseLike,
  SupabaseProposalStoreConfig,
  ProposalRow,
} from './proposal-store.js';

// Content runner
export {
  ContentRunnerImpl,
  createLiveContentRunner,
  scoreConfidence,
  validateContentPayload,
} from './content-runner.js';
export type {
  ContentRunner,
  ContentRunnerDeps,
  ContentRunnerInput,
  LiveContentRunnerConfig,
} from './content-runner.js';

// Outreach runner
export {
  OutreachRunnerImpl,
  createLiveOutreachRunner,
  createBacklinksDiscover,
  createSafeFetch,
  draftOutreachEmail,
  outreachQuery,
} from './outreach-runner.js';
export type {
  OutreachRunner,
  OutreachRunnerDeps,
  OutreachRunnerInput,
  OutreachEmail,
  DiscoverFn,
  SafeFetchFn,
  LiveOutreachRunnerConfig,
} from './outreach-runner.js';

// Cadence orchestration
export { runCadence } from './run-cadence.js';
export type { OrchestratorDeps } from './run-cadence.js';
