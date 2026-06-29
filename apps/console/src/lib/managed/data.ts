/**
 * Server-only Supabase data access for the Managed tier (service-role).
 *
 * Mirrors `lib/billing/store.ts`/`entitlements.ts`: service-role reads/writes bypass RLS, so callers
 * MUST authorize in app code (see {@link assertCanDecide}) before mutating. Returns `null` when
 * Supabase env is absent (dormant), so routes degrade to closed rather than throwing.
 */
import { createSupabaseClient } from '@aeo/storage';
import { rowToProposal, type ProposalRow } from '@aeo/orchestrator';
import type { CustomerProfile, Proposal, JobResult } from '@aeo/types';

type ServiceClient = NonNullable<ReturnType<typeof createSupabaseClient>>;

function nonEmptyEnv(name: string): string | undefined {
  const v = process.env[name];
  return v !== undefined && v.length > 0 ? v : undefined;
}

/** Service-role client, or `null` when Supabase env is absent. */
export function createServiceClient(): ServiceClient | null {
  const url = nonEmptyEnv('SUPABASE_URL');
  const serviceKey = nonEmptyEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (url === undefined || serviceKey === undefined) return null;
  return createSupabaseClient({ url, serviceKey });
}

interface CustomerProfileRow {
  id: string;
  owner_id: string;
  site_url: string;
  niche: string | null;
  topics: string[] | null;
  articles_per_month: number;
  outreach_placements_per_month: number;
}

function rowToProfile(row: CustomerProfileRow): CustomerProfile {
  return {
    id: row.id,
    ownerId: row.owner_id,
    siteUrl: row.site_url,
    niche: row.niche ?? '',
    topics: row.topics ?? [],
    cadence: {
      articlesPerMonth: row.articles_per_month,
      outreachPlacementsPerMonth: row.outreach_placements_per_month,
    },
    integrations: {},
  };
}

/** All managed customer profiles (service-role). */
export async function loadCustomerProfiles(client: ServiceClient): Promise<CustomerProfile[]> {
  const { data, error } = await client
    .from('customer_profiles')
    .select('id, owner_id, site_url, niche, topics, articles_per_month, outreach_placements_per_month');
  if (error !== null || data === null) return [];
  return (data as CustomerProfileRow[]).map(rowToProfile);
}

/** Record a cadence job in the managed_jobs ledger (idempotent on the unique (customer, kind, period)). */
export async function recordManagedJob(
  client: ServiceClient,
  ownerId: string,
  job: JobResult,
): Promise<void> {
  try {
    await client.from('managed_jobs').insert({
      customer_id: job.customerId,
      owner_id: ownerId,
      job_kind: job.jobKind,
      period: job.period,
      proposals_created: job.proposalsCreated,
    });
  } catch {
    // Ledger write is best-effort; never fail the cadence pass on a duplicate/insert hiccup.
  }
}

/** All `pending` proposals across customers, for the staff inbox (service-role). */
export async function listPendingProposals(client: ServiceClient): Promise<Proposal[]> {
  const { data, error } = await client
    .from('proposals')
    .select('id, customer_id, owner_id, kind, status, payload, dedupe_key, decided_by, decided_at, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error !== null || data === null) return [];
  return (data as ProposalRow[]).map(rowToProposal);
}

/** The customer's own site URL — used as the sole allowlisted href when sanitizing for publish (H3). */
export async function getCustomerSiteUrl(client: ServiceClient, customerId: string): Promise<string | null> {
  const { data, error } = await client
    .from('customer_profiles')
    .select('site_url')
    .eq('id', customerId)
    .maybeSingle();
  if (error !== null || data === null) return null;
  return (data as { site_url: string }).site_url;
}

/** Append an immutable audit row (M4). Never updated/deleted. */
export async function insertAudit(
  client: ServiceClient,
  entry: {
    proposalId: string;
    ownerId: string;
    action: 'created' | 'approved' | 'rejected' | 'executed' | 'failed';
    actorId: string;
    rationale?: string;
  },
): Promise<void> {
  await client.from('proposal_audit').insert({
    proposal_id: entry.proposalId,
    owner_id: entry.ownerId,
    action: entry.action,
    actor_id: entry.actorId,
    rationale: entry.rationale ?? null,
  });
}
