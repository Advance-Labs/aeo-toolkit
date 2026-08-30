/**
 * ProposalStore — the persistence seam for the approval inbox.
 *
 * Two implementations:
 *   - {@link InMemoryProposalStore}: zero-dependency, deterministic; used by every unit test.
 *   - {@link SupabaseProposalStore}: durable cross-run persistence against a `proposals` table,
 *     reached only through the small structural {@link SupabaseLike} seam (mirrors
 *     `@advance-labs/blogging`'s `SupabasePostStore`), so it needs no live network to type/build.
 *
 * Idempotency is keyed on the job dedupe key `customerId:jobKind:period`: {@link ProposalStore.createForJob}
 * persists a whole job's batch once, and a second call with the same key creates nothing. Re-running
 * a cadence period therefore never double-enqueues.
 *
 * NOTE (security invariant 2): the Supabase service-role bypasses RLS. Callers that mutate on a
 * customer's behalf MUST resolve the session, load the row, and assert ownership/staff-role BEFORE
 * calling `setStatus`/`delete`. This store deliberately does not embed that check — it is an
 * application-layer authorization control, not a storage concern.
 */
import { createSupabaseClient } from '@advance-labs/storage';
import type { Proposal, ProposalKind, ProposalStatus } from '@advance-labs/types';

/** Fields an inbox decision sets on a proposal. */
export interface ProposalStatusPatch {
  status: ProposalStatus;
  decidedBy?: string;
  decidedAt?: string;
}

/** Result of an idempotent job-batch create. */
export interface CreateForJobResult {
  /** The persisted proposals (the existing batch when `created` is false). */
  proposals: Proposal[];
  /** True when this call inserted the batch; false when the dedupe key was already present. */
  created: boolean;
}

/** Durable storage contract for proposals. All methods async to allow remote adapters. */
export interface ProposalStore {
  /**
   * Idempotently persist the proposals produced by one cadence job, keyed on `dedupeKey`
   * (`customerId:jobKind:period`). If the key already has proposals, creates nothing and returns
   * the existing batch with `created:false`.
   */
  createForJob(dedupeKey: string, proposals: Proposal[]): Promise<CreateForJobResult>;
  /** Fetch one proposal by id, or null if absent. */
  get(id: string): Promise<Proposal | null>;
  /** Every proposal for a customer (the authorization scope). */
  listByCustomer(customerId: string): Promise<Proposal[]>;
  /** A customer's proposals in a given status (e.g. the `pending` inbox queue). */
  listByStatus(customerId: string, status: ProposalStatus): Promise<Proposal[]>;
  /** Job dedupe keys already recorded for `customerId` in `period` — the input to `dueJobs`. */
  jobKeysForPeriod(customerId: string, period: string): Promise<Set<string>>;
  /** Apply an inbox decision (status + decidedBy/decidedAt). Throws if the id is unknown. */
  setStatus(id: string, patch: ProposalStatusPatch): Promise<Proposal>;
  /** Remove a proposal; resolves true if something was deleted. */
  delete(id: string): Promise<boolean>;
}

/** Thrown when a store operation fails (missing row, remote error). */
export class ProposalStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProposalStoreError';
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** The period suffix encoded in a dedupe key `customerId:jobKind:period`. */
function periodOfKey(key: string): string | undefined {
  const idx = key.lastIndexOf(':');
  return idx >= 0 ? key.slice(idx + 1) : undefined;
}

/** Parse `customerId` and `period` back out of a dedupe key `customerId:jobKind:period`. */
function parseKey(key: string): { customerId: string; period: string } {
  const parts = key.split(':');
  const period = parts[parts.length - 1] ?? '';
  const customerId = parts.slice(0, Math.max(0, parts.length - 2)).join(':');
  return { customerId, period };
}

/** In-memory store — deterministic, dependency-free, ideal for tests and dry runs. */
export class InMemoryProposalStore implements ProposalStore {
  private readonly proposals = new Map<string, Proposal>();
  /** proposal id -> job dedupe key. */
  private readonly keyById = new Map<string, string>();
  /** job dedupe key -> proposal ids inserted under it (insertion order). */
  private readonly idsByKey = new Map<string, string[]>();

  constructor(seed: Array<{ dedupeKey: string; proposal: Proposal }> = []) {
    for (const { dedupeKey, proposal } of seed) this.insert(dedupeKey, proposal);
  }

  private insert(dedupeKey: string, proposal: Proposal): void {
    this.proposals.set(proposal.id, clone(proposal));
    this.keyById.set(proposal.id, dedupeKey);
    const ids = this.idsByKey.get(dedupeKey) ?? [];
    ids.push(proposal.id);
    this.idsByKey.set(dedupeKey, ids);
  }

  createForJob(dedupeKey: string, proposals: Proposal[]): Promise<CreateForJobResult> {
    const existingIds = this.idsByKey.get(dedupeKey);
    if (existingIds !== undefined) {
      const existing = existingIds
        .map((id) => this.proposals.get(id))
        .filter((p): p is Proposal => p !== undefined)
        .map(clone);
      return Promise.resolve({ proposals: existing, created: false });
    }
    // Register the key even for an empty batch so a zero-proposal job is still marked done
    // (idempotency: it must not re-run next pass).
    this.idsByKey.set(dedupeKey, []);
    for (const p of proposals) this.insert(dedupeKey, p);
    return Promise.resolve({ proposals: proposals.map(clone), created: true });
  }

  get(id: string): Promise<Proposal | null> {
    const found = this.proposals.get(id);
    return Promise.resolve(found ? clone(found) : null);
  }

  listByCustomer(customerId: string): Promise<Proposal[]> {
    return Promise.resolve(
      [...this.proposals.values()].filter((p) => p.customerId === customerId).map(clone),
    );
  }

  listByStatus(customerId: string, status: ProposalStatus): Promise<Proposal[]> {
    return Promise.resolve(
      [...this.proposals.values()]
        .filter((p) => p.customerId === customerId && p.status === status)
        .map(clone),
    );
  }

  jobKeysForPeriod(customerId: string, period: string): Promise<Set<string>> {
    const keys = new Set<string>();
    for (const key of this.idsByKey.keys()) {
      const parsed = parseKey(key);
      if (parsed.customerId === customerId && parsed.period === period) keys.add(key);
    }
    return Promise.resolve(keys);
  }

  setStatus(id: string, patch: ProposalStatusPatch): Promise<Proposal> {
    const found = this.proposals.get(id);
    if (found === undefined) {
      return Promise.reject(new ProposalStoreError(`proposal '${id}' not found`));
    }
    const next: Proposal = { ...found, status: patch.status };
    if (patch.decidedBy !== undefined) next.decidedBy = patch.decidedBy;
    if (patch.decidedAt !== undefined) next.decidedAt = patch.decidedAt;
    this.proposals.set(id, next);
    return Promise.resolve(clone(next));
  }

  delete(id: string): Promise<boolean> {
    const key = this.keyById.get(id);
    const existed = this.proposals.delete(id);
    if (existed && key !== undefined) {
      this.keyById.delete(id);
      const ids = (this.idsByKey.get(key) ?? []).filter((x) => x !== id);
      if (ids.length === 0) this.idsByKey.delete(key);
      else this.idsByKey.set(key, ids);
    }
    return Promise.resolve(existed);
  }
}

// --- Supabase-backed implementation (mirrors @advance-labs/blogging's SupabasePostStore) ---

/** Shape of `{ data, error }` returned by terminal PostgREST builders. */
interface PostgrestResult<T> {
  data: T;
  error: { message: string } | null;
}

interface FilterBuilder extends PromiseLike<PostgrestResult<ProposalRow[] | null>> {
  eq(column: string, value: string): FilterBuilder;
  maybeSingle(): PromiseLike<PostgrestResult<ProposalRow | null>>;
}

interface MutationBuilder extends PromiseLike<PostgrestResult<unknown>> {
  eq(column: string, value: string): MutationBuilder;
}

interface TableQuery {
  select(columns: string): FilterBuilder;
  insert(values: ProposalRow[]): PromiseLike<PostgrestResult<unknown>>;
  update(values: Partial<ProposalRow>): MutationBuilder;
  delete(): MutationBuilder;
}

/**
 * The minimal structural surface this store uses. The real `SupabaseClient` query builder is a
 * structural superset; test fakes implement exactly this surface.
 */
export interface SupabaseLike {
  from(table: string): TableQuery;
}

/**
 * Raw `proposals` table row.
 *
 * Expected columns:
 *   id (text, pk), customer_id (text), owner_id (text), kind (text), status (text),
 *   payload (jsonb), dedupe_key (text), created_at (timestamptz), decided_by (text, nullable),
 *   decided_at (timestamptz, nullable).
 * Recommended indexes: (customer_id), (customer_id, status), (dedupe_key).
 * RLS: owner reads own rows; service-role writes (orchestrator + inbox execution).
 */
export interface ProposalRow {
  id: string;
  customer_id: string;
  owner_id: string;
  kind: ProposalKind;
  status: ProposalStatus;
  payload: Record<string, unknown>;
  dedupe_key: string;
  created_at: string;
  decided_by: string | null;
  decided_at: string | null;
}

export interface SupabaseProposalStoreConfig {
  client: SupabaseLike;
  table?: string;
}

const DEFAULT_PROPOSALS_TABLE = 'proposals';
const ALL_COLUMNS =
  'id, customer_id, owner_id, kind, status, payload, dedupe_key, created_at, decided_by, decided_at';

/** Map a domain `Proposal` + its job dedupe key to a database row. */
export function proposalToRow(proposal: Proposal, dedupeKey: string): ProposalRow {
  return {
    id: proposal.id,
    customer_id: proposal.customerId,
    owner_id: proposal.ownerId,
    kind: proposal.kind,
    status: proposal.status,
    payload: proposal.payload as Record<string, unknown>,
    dedupe_key: dedupeKey,
    created_at: proposal.createdAt,
    decided_by: proposal.decidedBy ?? null,
    decided_at: proposal.decidedAt ?? null,
  };
}

/** Map a database row back to a domain `Proposal` (the union is reconstructed via `kind`). */
export function rowToProposal(row: ProposalRow): Proposal {
  const base = {
    id: row.id,
    customerId: row.customer_id,
    ownerId: row.owner_id,
    kind: row.kind,
    status: row.status,
    payload: row.payload,
    createdAt: row.created_at,
    ...(row.decided_by !== null ? { decidedBy: row.decided_by } : {}),
    ...(row.decided_at !== null ? { decidedAt: row.decided_at } : {}),
  };
  // The row's `kind` discriminates the union; payload shape is owned by the producing runner.
  return base as unknown as Proposal;
}

/**
 * Supabase-backed ProposalStore. Untested against a live DB (per the build plan); the in-memory
 * store is the unit-tested reference. Build the real client with `@advance-labs/storage`'s
 * `createSupabaseClient` and pass it via {@link getProposalStore}.
 */
export class SupabaseProposalStore implements ProposalStore {
  private readonly client: SupabaseLike;
  private readonly tableName: string;

  constructor(config: SupabaseProposalStoreConfig) {
    this.client = config.client;
    this.tableName = config.table ?? DEFAULT_PROPOSALS_TABLE;
  }

  get table(): string {
    return this.tableName;
  }

  private async rowsForKey(dedupeKey: string): Promise<ProposalRow[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select(ALL_COLUMNS)
      .eq('dedupe_key', dedupeKey);
    if (error) throw new ProposalStoreError(`failed to load job '${dedupeKey}': ${error.message}`);
    return data ?? [];
  }

  async createForJob(dedupeKey: string, proposals: Proposal[]): Promise<CreateForJobResult> {
    const existing = await this.rowsForKey(dedupeKey);
    if (existing.length > 0) {
      return { proposals: existing.map(rowToProposal), created: false };
    }
    if (proposals.length === 0) return { proposals: [], created: true };
    const rows = proposals.map((p) => proposalToRow(p, dedupeKey));
    const { error } = await this.client.from(this.tableName).insert(rows);
    if (error) throw new ProposalStoreError(`failed to create job '${dedupeKey}': ${error.message}`);
    return { proposals: proposals.map((p) => ({ ...p })), created: true };
  }

  async get(id: string): Promise<Proposal | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select(ALL_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new ProposalStoreError(`failed to load proposal '${id}': ${error.message}`);
    return data === null ? null : rowToProposal(data);
  }

  async listByCustomer(customerId: string): Promise<Proposal[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select(ALL_COLUMNS)
      .eq('customer_id', customerId);
    if (error) throw new ProposalStoreError(`failed to list customer '${customerId}': ${error.message}`);
    return (data ?? []).map(rowToProposal);
  }

  async listByStatus(customerId: string, status: ProposalStatus): Promise<Proposal[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select(ALL_COLUMNS)
      .eq('customer_id', customerId)
      .eq('status', status);
    if (error) {
      throw new ProposalStoreError(`failed to list '${customerId}'/'${status}': ${error.message}`);
    }
    return (data ?? []).map(rowToProposal);
  }

  async jobKeysForPeriod(customerId: string, period: string): Promise<Set<string>> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('dedupe_key, customer_id')
      .eq('customer_id', customerId);
    if (error) {
      throw new ProposalStoreError(`failed to load keys for '${customerId}': ${error.message}`);
    }
    const keys = new Set<string>();
    for (const row of data ?? []) {
      if (periodOfKey(row.dedupe_key) === period) keys.add(row.dedupe_key);
    }
    return keys;
  }

  async setStatus(id: string, patch: ProposalStatusPatch): Promise<Proposal> {
    const update: Partial<ProposalRow> = { status: patch.status };
    if (patch.decidedBy !== undefined) update.decided_by = patch.decidedBy;
    if (patch.decidedAt !== undefined) update.decided_at = patch.decidedAt;
    const { error } = await this.client.from(this.tableName).update(update).eq('id', id);
    if (error) throw new ProposalStoreError(`failed to update '${id}': ${error.message}`);
    const updated = await this.get(id);
    if (updated === null) throw new ProposalStoreError(`proposal '${id}' not found after update`);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.get(id);
    if (existing === null) return false;
    const { error } = await this.client.from(this.tableName).delete().eq('id', id);
    if (error) throw new ProposalStoreError(`failed to delete '${id}': ${error.message}`);
    return true;
  }
}

/**
 * Env-gated ProposalStore factory. Returns a {@link SupabaseProposalStore} (real client via
 * `@advance-labs/storage`) when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are present; otherwise the
 * provided `fallback` (typically an {@link InMemoryProposalStore}), so local/dev/test run with no
 * secrets. An optional `client` override lets tests inject a fake Supabase seam without env.
 */
export function getProposalStore(
  env: Readonly<Record<string, string | undefined>>,
  fallback: ProposalStore,
  overrides?: { client?: SupabaseLike; table?: string },
): ProposalStore {
  const client = overrides?.client;
  if (client !== undefined) {
    const config: SupabaseProposalStoreConfig = { client };
    if (overrides?.table !== undefined) config.table = overrides.table;
    return new SupabaseProposalStore(config);
  }
  const url = env['SUPABASE_URL'];
  const serviceKey = env['SUPABASE_SERVICE_ROLE_KEY'];
  if (url && url.trim().length > 0 && serviceKey && serviceKey.trim().length > 0) {
    const supabase = createSupabaseClient({ url, serviceKey }) as unknown as SupabaseLike;
    const config: SupabaseProposalStoreConfig = { client: supabase };
    const table = env['PROPOSALS_TABLE'];
    if (table !== undefined && table.trim().length > 0) config.table = table;
    return new SupabaseProposalStore(config);
  }
  return fallback;
}
