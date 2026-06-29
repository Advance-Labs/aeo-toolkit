/**
 * @aeo/types — Autopilot managed-layer domain types.
 *
 * Shared shapes for the done-for-you "Managed" tier: per-customer cadence, the proposal/approval
 * model, job results, and the security primitives (guarded-fetch result, token-provider key).
 *
 * v1 proposal kinds in scope: `content`, `link-outreach`. The `link-placement` (marketplace) and
 * `community-reply` (Reddit) kinds are typed here so the union/store schema is locked, but are
 * `@deferred` to v1.5 and are not produced by any v1 runner.
 */

// --- Customer / cadence ---

/** A managed-tier customer's profile; drives the autopilot cadence. `ownerId` is the tenant boundary. */
export interface CustomerProfile {
  id: string;
  /** `auth.users` id of the owning account — the authorization boundary for every proposal/job. */
  ownerId: string;
  siteUrl: string;
  niche: string;
  topics: string[];
  cadence: CadenceTarget;
  integrations: CustomerIntegrations;
}

/** Monthly delivery targets for a managed customer (the work-delivered SLA, spec §0.4). */
export interface CadenceTarget {
  articlesPerMonth: number;
  outreachPlacementsPerMonth: number;
}

export interface CustomerIntegrations {
  cms?: { provider: string; connected: boolean };
  google?: { connected: boolean };
}

// --- Jobs ---

/** v1 job kinds. (`link.exchange` / `community.scan` are deferred to v1.5.) */
export type JobKind = 'content.generate' | 'link.outreach';

/** Outcome of one cadence job for one customer in one period. */
export interface JobResult {
  jobKind: JobKind;
  customerId: string;
  /** Calendar period the job covers, e.g. `'2026-06'` — part of the idempotency dedupe key. */
  period: string;
  proposalsCreated: number;
  skipped: boolean;
  reason?: string;
}

// --- Proposals (the approval model) ---

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
export type ProposalKind = 'content' | 'link-outreach' | 'link-placement' | 'community-reply';

interface ProposalBase {
  id: string;
  customerId: string;
  /** Mirrors the customer's `ownerId`; every inbox action MUST assert this against the session user. */
  ownerId: string;
  status: ProposalStatus;
  /** ISO-8601 timestamp (injected clock, never `Date.now()` in pure cores). */
  createdAt: string;
  decidedBy?: string;
  decidedAt?: string;
}

/** First-party article draft. Eligible for graduated auto-publish above a confidence threshold. */
export interface ContentProposal extends ProposalBase {
  kind: 'content';
  payload: ContentProposalPayload;
}
export interface ContentProposalPayload {
  title: string;
  slug: string;
  markdown: string;
  targetQuery: string;
  wordCount: number;
  /** 0–1 model/heuristic confidence; gates auto-publish (spec §0.2). */
  confidence: number;
}

/** A vetted outreach pitch to a real external site. Always human-gated (never auto-executed). */
export interface LinkOutreachProposal extends ProposalBase {
  kind: 'link-outreach';
  payload: LinkOutreachPayload;
}
export interface LinkOutreachPayload {
  prospectUrl: string;
  prospectDomain: string;
  contactEmail?: string;
  outreachSubject: string;
  outreachBody: string;
}

/** @deferred v1.5 — marketplace placement. Typed now to lock the union/store shape. */
export interface LinkPlacementProposal extends ProposalBase {
  kind: 'link-placement';
  payload: Record<string, unknown>;
}

/** @deferred v1.5 — Reddit/community reply draft. Typed now to lock the union/store shape. */
export interface CommunityReplyProposal extends ProposalBase {
  kind: 'community-reply';
  payload: Record<string, unknown>;
}

export type Proposal =
  | ContentProposal
  | LinkOutreachProposal
  | LinkPlacementProposal
  | CommunityReplyProposal;

// --- Security primitives ---

/** Discriminator for the hardened `(user_id, provider)` token-store key (security §H4). */
export type TokenProvider = 'google' | 'reddit' | 'cms';

/** Result of a guarded fetch from `@aeo/net-guard` (security §C1, SSRF). */
export interface SafeFetchResult {
  ok: boolean;
  status: number;
  /** Final URL after validated redirect hops. */
  url: string;
  body: string;
  /** Set when the request was refused by the guard rather than by the remote server. */
  blockedReason?: SafeFetchBlockReason;
}

export type SafeFetchBlockReason =
  | 'scheme-not-allowed'
  | 'private-address'
  | 'dns-resolution-failed'
  | 'too-many-redirects'
  | 'body-too-large'
  | 'timeout';
