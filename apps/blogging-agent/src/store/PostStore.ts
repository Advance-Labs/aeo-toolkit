/**
 * PostStore — the persistence seam for the blogging agent.
 *
 * Defines a typed interface plus two default implementations:
 *   - `InMemoryPostStore`: zero-dependency, used by tests and dry runs.
 *   - `JsonFilePostStore`: durable single-file JSON store (no native deps — NOT better-sqlite3).
 * A Supabase adapter is sketched as a typed STUB so the wiring point is obvious without pulling in
 * a live database during the build.
 */
import type { DedupCandidate } from '../agents/dedup.js';
import type { Post } from '../types.js';

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

// STUB: Supabase-backed PostStore.
//
// Production deployments persist posts in Supabase (Postgres). This adapter is intentionally
// unimplemented so the build needs no live database or `@supabase/supabase-js` dependency. Wire it
// by mapping each method to a query against a `posts` table keyed by `slug`. The `SupabaseLike`
// seam keeps this file SDK-free; inject a configured client at the call site.
export interface SupabaseLike {
  from(table: string): unknown;
}

export interface SupabasePostStoreConfig {
  client: SupabaseLike;
  table?: string;
}

export class SupabasePostStore implements PostStore {
  constructor(private readonly config: SupabasePostStoreConfig) {}

  /** The table the production adapter would target (referenced so `config` is not unused). */
  get table(): string {
    return this.config.table ?? 'posts';
  }

  // STUB: replace with `select('*')` from the posts table.
  all(): Promise<Post[]> {
    return Promise.reject(new SupabaseNotImplementedError('all'));
  }

  // STUB: `select('*').eq('slug', slug).maybeSingle()`.
  get(_slug: string): Promise<Post | null> {
    return Promise.reject(new SupabaseNotImplementedError('get'));
  }

  // STUB: `upsert(post, { onConflict: 'slug' })`.
  upsert(_post: Post): Promise<void> {
    return Promise.reject(new SupabaseNotImplementedError('upsert'));
  }

  // STUB: `upsert(posts, { onConflict: 'slug' })`.
  upsertMany(_posts: Post[]): Promise<void> {
    return Promise.reject(new SupabaseNotImplementedError('upsertMany'));
  }

  // STUB: `delete().eq('slug', slug)`.
  delete(_slug: string): Promise<boolean> {
    return Promise.reject(new SupabaseNotImplementedError('delete'));
  }

  // STUB: `select('slug, fingerprint')`.
  fingerprints(): Promise<DedupCandidate[]> {
    return Promise.reject(new SupabaseNotImplementedError('fingerprints'));
  }
}

export class SupabaseNotImplementedError extends Error {
  constructor(method: string) {
    super(`SupabasePostStore.${method} is a STUB — wire it to a Supabase client before use.`);
    this.name = 'SupabaseNotImplementedError';
  }
}
