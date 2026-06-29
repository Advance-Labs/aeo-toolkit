/**
 * Graduated-autonomy gate (pure) — spec §0.2.
 *
 * The only surface eligible for hands-off execution is *first-party content* published to the
 * customer's own CMS, and only when its confidence clears the policy threshold (near-zero
 * compliance risk — that is where the "magic" is). Every genuinely risky surface — `link-outreach`
 * today, marketplace/community later — is ALWAYS human-gated and can never auto-execute.
 *
 * Pure and total: no clock, no I/O. The console execution layer consults this before publishing.
 */
import type { Proposal } from '@aeo/types';

/** Tunable autonomy policy. v1 has a single knob: the content auto-publish confidence bar. */
export interface AutonomyPolicy {
  /** Content proposals with `confidence >= this` may auto-publish to the customer's CMS. */
  contentAutoPublishThreshold: number;
}

/** Conservative default — only high-confidence drafts auto-publish; everything else is reviewed. */
export const DEFAULT_AUTONOMY_POLICY: AutonomyPolicy = {
  contentAutoPublishThreshold: 0.85,
};

/**
 * True only for `content` proposals whose confidence meets the threshold. Always false for
 * `link-outreach` (and the deferred `link-placement` / `community-reply` kinds) — human-gated.
 */
export function shouldAutoExecute(proposal: Proposal, policy: AutonomyPolicy): boolean {
  if (proposal.kind !== 'content') return false;
  return proposal.payload.confidence >= policy.contentAutoPublishThreshold;
}
