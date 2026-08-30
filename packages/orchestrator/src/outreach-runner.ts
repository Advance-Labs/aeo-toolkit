/**
 * OutreachRunner — composes `@advance-labs/backlinks` discovery + contact extraction into vetted
 * {@link LinkOutreachProposal}s. ALWAYS human-gated; never auto-executed (see {@link shouldAutoExecute}).
 *
 * Pipeline per customer:
 *   discover prospects (backlinks `search`)  →  fetch each prospect page  →  extract contacts
 *   (backlinks `extractContacts`)            →  draft a deterministic pitch  →  pending proposal
 *
 * Security:
 *   - SSRF (invariant 1): every prospect-page fetch goes through the INJECTED {@link SafeFetchFn}
 *     (`@advance-labs/net-guard.safeFetch`), never a raw HTTP client. A blocked fetch is skipped, never turned
 *     into a proposal.
 *   - Target allowlist (invariant 6): the outreach copy is built from a fixed template; its single
 *     anchor is the customer's own agreed `siteUrl`, and the send target (`contactEmail`) comes only
 *     from contacts extracted off the prospect page — never a model-derived URL/address. No LLM is
 *     involved here, so there is no prompt-injection surface in the drafting step.
 */
import { extractContacts } from '@advance-labs/backlinks';
import type { HttpClient, SearchOutcome } from '@advance-labs/backlinks';
import { search } from '@advance-labs/backlinks';
import { safeFetch } from '@advance-labs/net-guard';
import type { SafeFetchDeps, SafeFetchOptions } from '@advance-labs/net-guard';
import type { CustomerProfile, LinkOutreachProposal, LinkOutreachPayload, SafeFetchResult } from '@advance-labs/types';
import { randomUUID } from 'node:crypto';

/** Discovery seam — wraps `@advance-labs/backlinks.search`. Returns candidate prospect results. */
export type DiscoverFn = (query: string, limit: number) => Promise<SearchOutcome>;

/** SSRF-guarded fetch seam — wraps `@advance-labs/net-guard.safeFetch` with its deps bound. */
export type SafeFetchFn = (url: string, options?: SafeFetchOptions) => Promise<SafeFetchResult>;

export interface OutreachRunnerDeps {
  discover: DiscoverFn;
  safeFetch: SafeFetchFn;
  now: () => Date;
  newId: () => string;
}

export interface OutreachRunnerInput {
  profile: CustomerProfile;
  period: string;
  /** Max placements to draft (the customer's monthly outreach target). */
  limit: number;
}

export interface OutreachRunner {
  run(input: OutreachRunnerInput): Promise<LinkOutreachProposal[]>;
}

/** A drafted outreach email — plain text, single agreed anchor, no model-derived targets. */
export interface OutreachEmail {
  subject: string;
  body: string;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** Build the discovery query for a customer's niche (guest-post / contribution intent). */
export function outreachQuery(profile: CustomerProfile): string {
  return `${profile.niche} "write for us"`;
}

/**
 * Deterministically draft an outreach pitch. The ONLY URL in the body is the customer's agreed
 * `siteUrl` (invariant 6); the prospect is referenced by bare domain, never a deep link, and no
 * model output is interpolated.
 */
export function draftOutreachEmail(profile: CustomerProfile, prospectDomain: string): OutreachEmail {
  const siteHost = hostOf(profile.siteUrl);
  const subject = `Guest content collaboration — ${siteHost} × ${prospectDomain}`;
  const body = [
    `Hi ${prospectDomain} team,`,
    '',
    `I run ${siteHost}, where we publish in-depth resources on ${profile.niche}. I came across`,
    `${prospectDomain} and think our audiences overlap well.`,
    '',
    `We'd love to contribute an original, genuinely useful article — and where it's truly relevant,`,
    `reference our resource at ${profile.siteUrl}. Happy to write to your guidelines.`,
    '',
    `Would a contribution be welcome?`,
    '',
    `Thanks,`,
    `The ${siteHost} team`,
  ].join('\n');
  return { subject, body };
}

export class OutreachRunnerImpl implements OutreachRunner {
  constructor(private readonly deps: OutreachRunnerDeps) {}

  async run(input: OutreachRunnerInput): Promise<LinkOutreachProposal[]> {
    const { deps } = this;
    // Over-fetch candidates: some will be blocked by the SSRF guard or fail to fetch.
    const candidates = Math.max(input.limit * 4, input.limit);
    const outcome = await deps.discover(outreachQuery(input.profile), candidates);

    const proposals: LinkOutreachProposal[] = [];
    for (const result of outcome.results) {
      if (proposals.length >= input.limit) break;

      // SSRF-guarded fetch — invariant 1. A blocked/failed fetch yields no proposal.
      const res = await deps.safeFetch(result.url, {});
      if (!res.ok || res.blockedReason !== undefined || res.body.length === 0) continue;

      const prospectDomain = hostOf(result.url);
      const contacts = extractContacts(res.body, res.url || result.url);
      const email = draftOutreachEmail(input.profile, prospectDomain);

      const payload: LinkOutreachPayload = {
        prospectUrl: result.url,
        prospectDomain,
        outreachSubject: email.subject,
        outreachBody: email.body,
      };
      // Allowlist the send target to an address extracted off the prospect page (invariant 6).
      const contactEmail = contacts.emails[0];
      if (contactEmail !== undefined) payload.contactEmail = contactEmail;

      proposals.push({
        id: deps.newId(),
        customerId: input.profile.id,
        ownerId: input.profile.ownerId,
        kind: 'link-outreach',
        status: 'pending',
        createdAt: deps.now().toISOString(),
        payload,
      });
    }
    return proposals;
  }
}

/** Build a {@link DiscoverFn} from a `@advance-labs/backlinks` HTTP client (search hits a fixed endpoint). */
export function createBacklinksDiscover(http: HttpClient): DiscoverFn {
  return (query, limit) => search(http, query, limit);
}

/** Bind `@advance-labs/net-guard.safeFetch` to its live deps, producing a {@link SafeFetchFn}. */
export function createSafeFetch(deps: SafeFetchDeps): SafeFetchFn {
  return (url, options) => safeFetch(url, options ?? {}, deps);
}

export interface LiveOutreachRunnerConfig {
  http: HttpClient;
  fetchDeps: SafeFetchDeps;
  now?: () => Date;
  newId?: () => string;
}

/** Production {@link OutreachRunner}: backlinks discovery + net-guarded prospect fetches. */
export function createLiveOutreachRunner(config: LiveOutreachRunnerConfig): OutreachRunner {
  return new OutreachRunnerImpl({
    discover: createBacklinksDiscover(config.http),
    safeFetch: createSafeFetch(config.fetchDeps),
    now: config.now ?? ((): Date => new Date()),
    newId: config.newId ?? ((): string => randomUUID()),
  });
}
