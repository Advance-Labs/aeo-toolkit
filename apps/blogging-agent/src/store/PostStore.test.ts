import { describe, expect, it } from 'vitest';
import type { Post } from '../types.js';
import {
  InMemoryPostStore,
  JsonFilePostStore,
  SupabaseNotImplementedError,
  SupabasePostStore,
  parsePosts,
} from './PostStore.js';
import type { FileIO } from './PostStore.js';

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

describe('SupabasePostStore (STUB)', () => {
  it('throws a typed not-implemented error from every method', async () => {
    const store = new SupabasePostStore({ client: { from: () => ({}) } });
    await expect(store.all()).rejects.toBeInstanceOf(SupabaseNotImplementedError);
    await expect(store.get('x')).rejects.toBeInstanceOf(SupabaseNotImplementedError);
    await expect(store.upsert(post('x'))).rejects.toBeInstanceOf(SupabaseNotImplementedError);
  });
});
