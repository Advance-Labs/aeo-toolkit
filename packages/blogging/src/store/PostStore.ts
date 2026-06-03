/**
 * PostStore — the persistence seam for the blogging agent.
 *
 * Defines a typed interface plus three implementations:
 *   - `InMemoryPostStore`: zero-dependency, used by tests and dry runs.
 *   - `JsonFilePostStore`: durable single-file JSON store (no native deps — NOT better-sqlite3).
 *   - `SupabasePostStore`: durable cross-run persistence against a `posts` table (production).
 * The `getPostStore` factory picks Supabase when its env vars are present, else the JSON/in-memory
 * fallback, so local dev and tests run with no secrets.
 */
import { createSupabaseClient } from '@aeo/storage';
import type { DedupCandidate } from '../agents/dedup.js';
import type { Post, PostHealth, PostStatus } from '../types.js';
import type { Env } from '../config.js';

/** Durable storage contract for posts. All methods are async to allow remote adapters. */
export interface PostStore {
  /** Return every stored post. */
  all(): Promise<Post[]>;
  /** Fetch one post by slug, or null if absent. */
  get(slug: string): Promise<Post | null>;
  /** Insert or replace a post (keyed by slug). */
  upsert(post: Post): Promise<void>;
  /** Insert or replace many posts in one call. */
  upsertMany(posts: Post[]): Promise<void>;
  /** Remove a post; resolves true if something was deleted. */
  delete(slug: string): Promise<boolean>;
  /** Dedup fingerprints for every stored post (the dedup corpus). */
  fingerprints(): Promise<DedupCandidate[]>;
}

/** In-memory store — deterministic, dependency-free, ideal for tests and dry runs. */
export class InMemoryPostStore implements PostStore {
  private readonly posts = new Map<string, Post>();

  constructor(seed: Post[] = []) {
    for (const p of seed) this.posts.set(p.slug, clone(p));
  }

  all(): Promise<Post[]> {
    return Promise.resolve([...this.posts.values()].map(clone));
  }

  get(slug: string): Promise<Post | null> {
    const found = this.posts.get(slug);
    return Promise.resolve(found ? clone(found) : null);
  }

  upsert(post: Post): Promise<void> {
    this.posts.set(post.slug, clone(post));
    return Promise.resolve();
  }

  upsertMany(posts: Post[]): Promise<void> {
    for (const p of posts) this.posts.set(p.slug, clone(p));
    return Promise.resolve();
  }

  delete(slug: string): Promise<boolean> {
    return Promise.resolve(this.posts.delete(slug));
  }

  fingerprints(): Promise<DedupCandidate[]> {
    return Promise.resolve(
      [...this.posts.values()].map((p) => ({ slug: p.slug, fingerprint: [...p.fingerprint] })),
    );
  }
}

/** The minimal async filesystem operations the JSON store needs. */
export interface FileIO {
  readFile(path: string): Promise<string>;
  writeFile(path: string, data: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

/**
 * Durable JSON-file store. Loads the whole file into memory on first access and writes the full
 * snapshot back on every mutation — fine for the agent's modest post volume and avoids any native
 * dependency. The `FileIO` seam is injected so tests run without touching disk.
 */
export class JsonFilePostStore implements PostStore {
  private cache: Map<string, Post> | null = null;

  constructor(
    private readonly path: string,
    private readonly io: FileIO,
  ) {}

  private async load(): Promise<Map<string, Post>> {
    if (this.cache) return this.cache;
    const map = new Map<string, Post>();
    if (await this.io.exists(this.path)) {
      const raw = await this.io.readFile(this.path);
      const parsed = parsePosts(raw);
      for (const p of parsed) map.set(p.slug, p);
    }
    this.cache = map;
    return map;
  }

  private async flush(): Promise<void> {
    const map = await this.load();
    const data = JSON.stringify([...map.values()], null, 2);
    await this.io.writeFile(this.path, data);
  }

  async all(): Promise<Post[]> {
    const map = await this.load();
    return [...map.values()].map(clone);
  }

  async get(slug: string): Promise<Post | null> {
    const map = await this.load();
    const found = map.get(slug);
    return found ? clone(found) : null;
  }

  async upsert(post: Post): Promise<void> {
    const map = await this.load();
    map.set(post.slug, clone(post));
    await this.flush();
  }

  async upsertMany(posts: Post[]): Promise<void> {
    const map = await this.load();
    for (const p of posts) map.set(p.slug, clone(p));
    await this.flush();
  }

  async delete(slug: string): Promise<boolean> {
    const map = await this.load();
    const existed = map.delete(slug);
    if (existed) await this.flush();
    return existed;
  }

  async fingerprints(): Promise<DedupCandidate[]> {
    const map = await this.load();
    return [...map.values()].map((p) => ({ slug: p.slug, fingerprint: [...p.fingerprint] }));
  }
}

/** Parse a posts JSON array, narrowing unknown content and skipping malformed entries. */
export function parsePosts(raw: string): Post[] {
  if (raw.trim().length === 0) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isPost).map(clone);
}

function isPost(value: unknown): value is Post {
  if (typeof value !== 'object' || value === null) return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o['slug'] === 'string' &&
    typeof o['title'] === 'string' &&
    typeof o['status'] === 'string' &&
    typeof o['markdown'] === 'string' &&
    Array.isArray(o['fingerprint'])
  );
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * Supabase-backed PostStore.
 *
 * Persists posts in a `posts` table (Postgres) keyed by `slug`. Camel-cased domain fields map to
 * snake_case columns; `fingerprint` and `health` are stored as JSON-compatible columns (text[]/jsonb).
 * The Supabase SDK is reached only through the small structural {@link SupabaseLike} seam, so tests
 * inject a fake with the same chainable shape and never touch the network. Build the real client
 * with `@aeo/storage`'s `createSupabaseClient` and pass it in (see {@link getPostStore}).
 *
 * Expected `posts` table columns:
 *   slug (text, pk), title, primary_keyword, status, markdown, fingerprint (text[]), created_at,
 *   updated_at, scheduled_for (nullable), published_at (nullable), url (nullable),
 *   health (jsonb, nullable), revision_count (int).
 */

/** Shape of `{ data, error }` returned by terminal PostgREST builders. */
interface PostgrestResult<T> {
  data: T;
  error: { message: string } | null;
}

/** A PostgREST select builder is await-able and chainable for the calls we use. */
interface SelectBuilder<Row> extends PromiseLike<PostgrestResult<Row[] | null>> {
  eq(column: string, value: string): SingleSelectBuilder<Row>;
}

interface SingleSelectBuilder<Row> {
  maybeSingle(): PromiseLike<PostgrestResult<Row | null>>;
}

interface MutationBuilder extends PromiseLike<PostgrestResult<unknown>> {
  eq(column: string, value: string): MutationBuilder;
}

interface TableQuery<Row> {
  select(columns: string): SelectBuilder<Row>;
  upsert(values: Row | Row[], options: { onConflict: string }): MutationBuilder;
  delete(): MutationBuilder;
}

/**
 * The minimal structural surface of a Supabase client this store uses:
 * `from(table).select().eq().maybeSingle()`, `.upsert(rows, { onConflict })`, `.delete().eq()`.
 * The real `SupabaseClient`'s query builder is a structural superset; test fakes implement exactly
 * this surface and pass through the same constructor.
 */
export interface SupabaseLike {
  from(table: string): TableQuery<PostRow>;
}

/** Raw database row layout for the `posts` table. */
export interface PostRow {
  slug: string;
  title: string;
  primary_keyword: string;
  status: PostStatus;
  markdown: string;
  fingerprint: string[];
  created_at: string;
  updated_at: string;
  scheduled_for: string | null;
  published_at: string | null;
  url: string | null;
  health: PostHealth | null;
  revision_count: number;
}

export interface SupabasePostStoreConfig {
  client: SupabaseLike;
  table?: string;
}

const DEFAULT_POSTS_TABLE = 'posts';
const SLUG_COLUMN = 'slug';
const ALL_COLUMNS =
  'slug, title, primary_keyword, status, markdown, fingerprint, created_at, updated_at, ' +
  'scheduled_for, published_at, url, health, revision_count';

/** Thrown when a Supabase operation returns an error. */
export class PostStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PostStoreError';
  }
}

export class SupabasePostStore implements PostStore {
  private readonly client: SupabaseLike;
  private readonly tableName: string;

  constructor(config: SupabasePostStoreConfig) {
    this.client = config.client;
    this.tableName = config.table ?? DEFAULT_POSTS_TABLE;
  }

  /** The table this adapter targets. */
  get table(): string {
    return this.tableName;
  }

  async all(): Promise<Post[]> {
    const { data, error } = await this.client.from(this.tableName).select(ALL_COLUMNS);
    if (error) throw new PostStoreError(`failed to load posts: ${error.message}`);
    return (data ?? []).map(rowToPost);
  }

  async get(slug: string): Promise<Post | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select(ALL_COLUMNS)
      .eq(SLUG_COLUMN, slug)
      .maybeSingle();
    if (error) throw new PostStoreError(`failed to load post '${slug}': ${error.message}`);
    return data === null ? null : rowToPost(data);
  }

  async upsert(post: Post): Promise<void> {
    const { error } = await this.client
      .from(this.tableName)
      .upsert(postToRow(post), { onConflict: SLUG_COLUMN });
    if (error) throw new PostStoreError(`failed to upsert post '${post.slug}': ${error.message}`);
  }

  async upsertMany(posts: Post[]): Promise<void> {
    if (posts.length === 0) return;
    const { error } = await this.client
      .from(this.tableName)
      .upsert(posts.map(postToRow), { onConflict: SLUG_COLUMN });
    if (error) throw new PostStoreError(`failed to upsert ${posts.length} posts: ${error.message}`);
  }

  async delete(slug: string): Promise<boolean> {
    const existing = await this.get(slug);
    if (existing === null) return false;
    const { error } = await this.client.from(this.tableName).delete().eq(SLUG_COLUMN, slug);
    if (error) throw new PostStoreError(`failed to delete post '${slug}': ${error.message}`);
    return true;
  }

  async fingerprints(): Promise<DedupCandidate[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select(`${SLUG_COLUMN}, fingerprint`);
    if (error) throw new PostStoreError(`failed to load fingerprints: ${error.message}`);
    return (data ?? []).map((row) => ({
      slug: row.slug,
      fingerprint: [...(row.fingerprint ?? [])],
    }));
  }
}

/** Map a domain `Post` to its database row (camelCase → snake_case; undefined → null). */
export function postToRow(post: Post): PostRow {
  return {
    slug: post.slug,
    title: post.title,
    primary_keyword: post.primaryKeyword,
    status: post.status,
    markdown: post.markdown,
    fingerprint: [...post.fingerprint],
    created_at: post.createdAt,
    updated_at: post.updatedAt,
    scheduled_for: post.scheduledFor ?? null,
    published_at: post.publishedAt ?? null,
    url: post.url ?? null,
    health: post.health ?? null,
    revision_count: post.revisionCount,
  };
}

/** Map a database row back to a domain `Post` (snake_case → camelCase; null → omitted). */
export function rowToPost(row: PostRow): Post {
  const post: Post = {
    slug: row.slug,
    title: row.title,
    primaryKeyword: row.primary_keyword,
    status: row.status,
    markdown: row.markdown,
    fingerprint: [...(row.fingerprint ?? [])],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revisionCount: row.revision_count,
  };
  if (row.scheduled_for !== null) post.scheduledFor = row.scheduled_for;
  if (row.published_at !== null) post.publishedAt = row.published_at;
  if (row.url !== null) post.url = row.url;
  if (row.health !== null) post.health = row.health;
  return post;
}

/**
 * Env-gated PostStore factory.
 *
 * Returns a {@link SupabasePostStore} (real client built via `@aeo/storage`) when both
 * `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present; otherwise the durable
 * {@link JsonFilePostStore} (or {@link InMemoryPostStore} when no `FileIO`/path is available),
 * so local dev and tests run with no secrets. An optional `client` override lets tests inject a
 * fake Supabase seam without env.
 */
export function getPostStore(
  env: Env,
  fallback: PostStore,
  overrides?: { client?: SupabaseLike; table?: string },
): PostStore {
  const client = overrides?.client;
  if (client !== undefined) {
    const config: SupabasePostStoreConfig = { client };
    if (overrides?.table !== undefined) config.table = overrides.table;
    return new SupabasePostStore(config);
  }

  const url = env['SUPABASE_URL'];
  const serviceKey = env['SUPABASE_SERVICE_ROLE_KEY'];
  if (
    url !== undefined &&
    url.trim().length > 0 &&
    serviceKey !== undefined &&
    serviceKey.trim().length > 0
  ) {
    // The real SupabaseClient query builder is a structural superset of our narrow seam.
    const supabase = createSupabaseClient({ url, serviceKey }) as unknown as SupabaseLike;
    const config: SupabasePostStoreConfig = { client: supabase };
    const table = env['POSTS_TABLE'];
    if (table !== undefined && table.trim().length > 0) config.table = table;
    return new SupabasePostStore(config);
  }

  return fallback;
}
