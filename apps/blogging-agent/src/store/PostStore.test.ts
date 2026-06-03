import { describe, expect, it } from 'vitest';
import type { Post } from '../types.js';
import {
  InMemoryPostStore,
  JsonFilePostStore,
  PostStoreError,
  SupabasePostStore,
  getPostStore,
  parsePosts,
  postToRow,
  rowToPost,
} from './PostStore.js';
import type { FileIO, PostRow, SupabaseLike } from './PostStore.js';

function post(slug: string): Post {
  return {
    slug,
    title: slug,
    primaryKeyword: slug,
    status: 'drafted',
    markdown: `# ${slug}`,
    fingerprint: [`${slug} a`, `${slug} b`],
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    revisionCount: 0,
  };
}

/** In-memory FileIO so the JSON store can be tested without touching disk. */
function memFileIO(initial?: string): { io: FileIO; data: { value: string | undefined } } {
  const data = { value: initial };
  const io: FileIO = {
    readFile: (_p) => Promise.resolve(data.value ?? ''),
    writeFile: (_p, d) => {
      data.value = d;
      return Promise.resolve();
    },
    exists: (_p) => Promise.resolve(data.value !== undefined),
  };
  return { io, data };
}

describe('InMemoryPostStore', () => {
  it('upserts, gets, lists, and deletes with defensive cloning', async () => {
    const store = new InMemoryPostStore();
    await store.upsert(post('a'));
    const got = await store.get('a');
    expect(got?.slug).toBe('a');

    // Mutating the returned object must not affect the store.
    if (got) got.title = 'mutated';
    expect((await store.get('a'))?.title).toBe('a');

    await store.upsertMany([post('b'), post('c')]);
    expect((await store.all()).map((p) => p.slug).sort()).toEqual(['a', 'b', 'c']);

    expect(await store.delete('b')).toBe(true);
    expect(await store.delete('zzz')).toBe(false);
    expect(await store.get('b')).toBeNull();
  });

  it('exposes dedup fingerprints for the corpus', async () => {
    const store = new InMemoryPostStore([post('a')]);
    const fps = await store.fingerprints();
    expect(fps).toEqual([{ slug: 'a', fingerprint: ['a a', 'a b'] }]);
  });
});

describe('JsonFilePostStore', () => {
  it('persists a snapshot through the injected FileIO and reloads it', async () => {
    const { io, data } = memFileIO();
    const store = new JsonFilePostStore('/tmp/posts.json', io);
    await store.upsert(post('a'));
    await store.upsertMany([post('b')]);

    expect(data.value).toBeDefined();
    const reloaded = new JsonFilePostStore('/tmp/posts.json', io);
    expect((await reloaded.all()).map((p) => p.slug).sort()).toEqual(['a', 'b']);
  });

  it('deletes and reflects the change on disk', async () => {
    const seed = JSON.stringify([post('a'), post('b')]);
    const { io } = memFileIO(seed);
    const store = new JsonFilePostStore('/tmp/posts.json', io);
    expect(await store.delete('a')).toBe(true);
    expect((await store.all()).map((p) => p.slug)).toEqual(['b']);
  });
});

describe('parsePosts', () => {
  it('returns [] for empty input and skips malformed entries', () => {
    expect(parsePosts('')).toEqual([]);
    expect(parsePosts('{}')).toEqual([]);
    const mixed = JSON.stringify([post('ok'), { slug: 'bad' }, 42]);
    expect(parsePosts(mixed).map((p) => p.slug)).toEqual(['ok']);
  });
});

type FakeErr = { message: string } | null;
type FakeResult<T> = { data: T; error: FakeErr };

/**
 * A fake Supabase client backed by an in-memory `posts` table. It mimics the chainable PostgREST
 * builder surface the store uses (`from().select().eq().maybeSingle()`, `.upsert()`, `.delete().eq()`)
 * and never touches the network. An optional `errorOn` set forces `{ error }` responses to exercise
 * the error path.
 *
 * Terminal builders are real `Promise`s (so they satisfy `PromiseLike`) augmented with the chaining
 * methods the store calls; the whole thing is narrowed to `SupabaseLike` at the boundary — exactly
 * how the production code narrows the real client.
 */
function fakeSupabase(
  seed: PostRow[] = [],
  errorOn: ReadonlySet<'select' | 'upsert' | 'delete'> = new Set(),
): { client: SupabaseLike; rows: Map<string, PostRow> } {
  const rows = new Map<string, PostRow>(seed.map((r) => [r.slug, r]));
  const err = (op: 'select' | 'upsert' | 'delete'): FakeErr =>
    errorOn.has(op) ? { message: `boom-${op}` } : null;

  /** Build a thenable terminal builder: a resolved Promise with extra chaining methods attached. */
  function builder<T>(value: FakeResult<T>, methods: Record<string, unknown> = {}): unknown {
    return Object.assign(Promise.resolve(value), methods);
  }

  const client = {
    from(table: string) {
      expect(table).toBe('posts');
      return {
        select(_columns: string) {
          const e = err('select');
          return builder<PostRow[] | null>(
            { data: e ? null : [...rows.values()], error: e },
            {
              eq(column: string, value: string) {
                const match = column === 'slug' ? (rows.get(value) ?? null) : null;
                return {
                  maybeSingle: (): Promise<FakeResult<PostRow | null>> =>
                    Promise.resolve({ data: e ? null : match, error: e }),
                };
              },
            },
          );
        },
        upsert(values: PostRow | PostRow[], options: { onConflict: string }) {
          expect(options.onConflict).toBe('slug');
          const e = err('upsert');
          if (!e) for (const r of Array.isArray(values) ? values : [values]) rows.set(r.slug, r);
          return builder<unknown>({ data: null, error: e });
        },
        delete() {
          const e = err('delete');
          return builder<unknown>(
            { data: null, error: e },
            {
              eq(column: string, value: string) {
                if (!e && column === 'slug') rows.delete(value);
                return builder<unknown>({ data: null, error: e });
              },
            },
          );
        },
      };
    },
  };
  return { client: client as unknown as SupabaseLike, rows };
}

describe('postToRow / rowToPost', () => {
  it('round-trips a post through the row representation', () => {
    const p = post('rt');
    p.scheduledFor = '2026-07-01';
    p.publishedAt = '2026-07-02T00:00:00.000Z';
    p.url = 'https://example.com/blog/rt';
    p.health = {
      clicks: 1,
      impressions: 10,
      ctr: 0.1,
      position: 5,
      pageViews: 3,
      score: 0.6,
      measuredAt: '2026-07-02T00:00:00.000Z',
    };
    expect(rowToPost(postToRow(p))).toEqual(p);
  });

  it('maps absent optional fields to null and back to omitted', () => {
    const row = postToRow(post('min'));
    expect(row.scheduled_for).toBeNull();
    expect(row.published_at).toBeNull();
    expect(row.url).toBeNull();
    expect(row.health).toBeNull();
    const back = rowToPost(row);
    expect('scheduledFor' in back).toBe(false);
    expect('url' in back).toBe(false);
    expect('health' in back).toBe(false);
  });
});

describe('SupabasePostStore', () => {
  it('upserts, gets, lists, deletes, and exposes fingerprints', async () => {
    const { client, rows } = fakeSupabase();
    const store = new SupabasePostStore({ client });

    await store.upsert(post('a'));
    expect(rows.get('a')?.title).toBe('a');

    const got = await store.get('a');
    expect(got?.slug).toBe('a');
    expect(await store.get('missing')).toBeNull();

    await store.upsertMany([post('b'), post('c')]);
    expect((await store.all()).map((p) => p.slug).sort()).toEqual(['a', 'b', 'c']);

    expect(await store.fingerprints()).toContainEqual({ slug: 'a', fingerprint: ['a a', 'a b'] });

    expect(await store.delete('b')).toBe(true);
    expect(await store.delete('missing')).toBe(false);
    expect((await store.all()).map((p) => p.slug).sort()).toEqual(['a', 'c']);
  });

  it('targets a custom table when configured', async () => {
    const { client } = fakeSupabase();
    const store = new SupabasePostStore({ client, table: 'posts' });
    expect(store.table).toBe('posts');
  });

  it('upsertMany on an empty array is a no-op', async () => {
    const { client, rows } = fakeSupabase();
    const store = new SupabasePostStore({ client });
    await store.upsertMany([]);
    expect(rows.size).toBe(0);
  });

  it('wraps Supabase errors in a typed PostStoreError', async () => {
    const selectErr = new SupabasePostStore({
      client: fakeSupabase([], new Set(['select'])).client,
    });
    await expect(selectErr.all()).rejects.toBeInstanceOf(PostStoreError);
    await expect(selectErr.get('a')).rejects.toBeInstanceOf(PostStoreError);
    await expect(selectErr.fingerprints()).rejects.toBeInstanceOf(PostStoreError);

    const upsertErr = new SupabasePostStore({
      client: fakeSupabase([], new Set(['upsert'])).client,
    });
    await expect(upsertErr.upsert(post('a'))).rejects.toBeInstanceOf(PostStoreError);

    // delete() first reads (get) then deletes; seed a row so the read succeeds and the delete fails.
    const deleteErr = new SupabasePostStore({
      client: fakeSupabase([postToRow(post('a'))], new Set(['delete'])).client,
    });
    await expect(deleteErr.delete('a')).rejects.toBeInstanceOf(PostStoreError);
  });
});

describe('getPostStore (env-gated factory)', () => {
  it('returns the fallback store when Supabase env vars are absent', () => {
    const fallback = new InMemoryPostStore();
    expect(getPostStore({}, fallback)).toBe(fallback);
  });

  it('returns a SupabasePostStore when an explicit client override is given', () => {
    const fallback = new InMemoryPostStore();
    const { client } = fakeSupabase();
    const store = getPostStore({}, fallback, { client });
    expect(store).toBeInstanceOf(SupabasePostStore);
    expect(store).not.toBe(fallback);
  });

  it('honors a table override alongside a client override', async () => {
    const fallback = new InMemoryPostStore();
    const { client } = fakeSupabase();
    const store = getPostStore({}, fallback, { client, table: 'posts' });
    expect(store).toBeInstanceOf(SupabasePostStore);
    // Exercise it to prove the override client is wired in.
    await store.upsert(post('x'));
    expect((await store.all()).map((p) => p.slug)).toEqual(['x']);
  });
});
