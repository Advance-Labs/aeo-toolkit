import { describe, expect, it, vi } from 'vitest';
import type { Post } from '../types.js';
import { CmsPublisher, NoopPublisher, PublishError, getPublisher, joinUrl } from './Publisher.js';
import type { FetchLike, FetchResponseLike } from './Publisher.js';

const NOW = () => new Date('2026-06-03T00:00:00.000Z');

function post(overrides: Partial<Post> = {}): Post {
  return {
    slug: 'my-post',
    title: 'My Post',
    primaryKeyword: 'my keyword',
    status: 'scheduled',
    markdown: '# My Post\n\nBody.',
    fingerprint: ['my post', 'post body'],
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    revisionCount: 0,
    ...overrides,
  };
}

/** A `FetchLike` that records calls and returns scripted responses in order. */
function scriptedFetch(responses: FetchResponseLike[]): {
  fetch: FetchLike;
  calls: { url: string; init: Parameters<FetchLike>[1] }[];
} {
  const calls: { url: string; init: Parameters<FetchLike>[1] }[] = [];
  let i = 0;
  const fetch: FetchLike = (url, init) => {
    calls.push({ url, init });
    const res = responses[i++];
    if (res === undefined) throw new Error('fetch called more times than scripted');
    return Promise.resolve(res);
  };
  return { fetch, calls };
}

function ok(body = ''): FetchResponseLike {
  return { ok: true, status: 200, text: () => Promise.resolve(body) };
}

function fail(status: number, body = ''): FetchResponseLike {
  return { ok: false, status, text: () => Promise.resolve(body) };
}

describe('joinUrl', () => {
  it('joins without doubling slashes', () => {
    expect(joinUrl('https://x.com/', '/blog/a')).toBe('https://x.com/blog/a');
    expect(joinUrl('https://x.com', 'blog/a')).toBe('https://x.com/blog/a');
  });
});

describe('NoopPublisher', () => {
  it('computes a canonical URL without any I/O', async () => {
    const result = await new NoopPublisher('https://example.com', NOW).publish(post());
    expect(result.url).toBe('https://example.com/blog/my-post');
    expect(result.ref).toBe('dry-run');
    expect(result.publishedAt).toBe('2026-06-03T00:00:00.000Z');
  });
});

describe('CmsPublisher', () => {
  it('POSTs the rendered post to the webhook and returns the canonical URL', async () => {
    const { fetch, calls } = scriptedFetch([ok('{"id":"entry-42"}')]);
    const publisher = new CmsPublisher({
      baseUrl: 'https://example.com',
      webhookUrl: 'https://cms.example/ingest',
      fetch,
      now: NOW,
    });

    const result = await publisher.publish(post());

    expect(result.url).toBe('https://example.com/blog/my-post');
    expect(result.ref).toBe('entry-42');
    expect(result.publishedAt).toBe('2026-06-03T00:00:00.000Z');

    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call?.url).toBe('https://cms.example/ingest');
    expect(call?.init.method).toBe('POST');
    expect(call?.init.headers['content-type']).toBe('application/json');
    const sent = JSON.parse(call?.init.body ?? '{}') as Record<string, unknown>;
    expect(sent).toEqual({
      slug: 'my-post',
      title: 'My Post',
      markdown: '# My Post\n\nBody.',
      primaryKeyword: 'my keyword',
      canonical: 'https://example.com/blog/my-post',
    });
  });

  it('prefers the post-supplied canonical URL when present', async () => {
    const { fetch, calls } = scriptedFetch([ok()]);
    const publisher = new CmsPublisher({
      baseUrl: 'https://example.com',
      webhookUrl: 'https://cms.example/ingest',
      fetch,
      now: NOW,
    });
    const result = await publisher.publish(post({ url: 'https://example.com/custom/path' }));
    expect(result.url).toBe('https://example.com/custom/path');
    const sent = JSON.parse(calls[0]?.init.body ?? '{}') as Record<string, unknown>;
    expect(sent['canonical']).toBe('https://example.com/custom/path');
  });

  it('sends a request-scoped bearer token without logging it', async () => {
    const { fetch, calls } = scriptedFetch([ok()]);
    const publisher = new CmsPublisher({
      baseUrl: 'https://example.com',
      webhookUrl: 'https://cms.example/ingest',
      token: 'super-secret',
      fetch,
      now: NOW,
    });
    await publisher.publish(post());
    expect(calls[0]?.init.headers['authorization']).toBe('Bearer super-secret');
  });

  it('triggers the deploy hook with an empty POST after a successful publish', async () => {
    const { fetch, calls } = scriptedFetch([ok(), ok()]);
    const publisher = new CmsPublisher({
      baseUrl: 'https://example.com',
      webhookUrl: 'https://cms.example/ingest',
      deployHookUrl: 'https://deploy.example/hook',
      fetch,
      now: NOW,
    });

    await publisher.publish(post());

    expect(calls).toHaveLength(2);
    expect(calls[1]?.url).toBe('https://deploy.example/hook');
    expect(calls[1]?.init.method).toBe('POST');
    expect(calls[1]?.init.body).toBe('');
  });

  it('does not call the deploy hook when none is configured', async () => {
    const { fetch, calls } = scriptedFetch([ok()]);
    const publisher = new CmsPublisher({
      baseUrl: 'https://example.com',
      webhookUrl: 'https://cms.example/ingest',
      fetch,
      now: NOW,
    });
    await publisher.publish(post());
    expect(calls).toHaveLength(1);
  });

  it('throws PublishError when the webhook fails (and skips the deploy hook)', async () => {
    const { fetch, calls } = scriptedFetch([fail(500, 'cms down')]);
    const publisher = new CmsPublisher({
      baseUrl: 'https://example.com',
      webhookUrl: 'https://cms.example/ingest',
      deployHookUrl: 'https://deploy.example/hook',
      fetch,
      now: NOW,
    });
    await expect(publisher.publish(post())).rejects.toBeInstanceOf(PublishError);
    // Only the webhook was attempted; the deploy hook was not fired.
    expect(calls).toHaveLength(1);
  });

  it('throws PublishError when the deploy hook fails after a successful publish', async () => {
    const { fetch } = scriptedFetch([ok(), fail(502)]);
    const publisher = new CmsPublisher({
      baseUrl: 'https://example.com',
      webhookUrl: 'https://cms.example/ingest',
      deployHookUrl: 'https://deploy.example/hook',
      fetch,
      now: NOW,
    });
    await expect(publisher.publish(post())).rejects.toMatchObject({
      name: 'PublishError',
      slug: 'my-post',
    });
  });

  it('omits ref when the webhook returns no parseable id', async () => {
    const { fetch } = scriptedFetch([ok('not json')]);
    const publisher = new CmsPublisher({
      baseUrl: 'https://example.com',
      webhookUrl: 'https://cms.example/ingest',
      fetch,
      now: NOW,
    });
    const result = await publisher.publish(post());
    expect(result.ref).toBeUndefined();
  });
});

describe('getPublisher (env-gated factory)', () => {
  it('returns a NoopPublisher when PUBLISH_WEBHOOK_URL is absent', async () => {
    const publisher = getPublisher({}, 'https://example.com');
    expect(publisher).toBeInstanceOf(NoopPublisher);
    const result = await publisher.publish(post());
    expect(result.ref).toBe('dry-run');
  });

  it('returns a CmsPublisher wired to the webhook when PUBLISH_WEBHOOK_URL is set', async () => {
    const { fetch, calls } = scriptedFetch([ok(), ok()]);
    const publisher = getPublisher(
      {
        PUBLISH_WEBHOOK_URL: 'https://cms.example/ingest',
        DEPLOY_HOOK_URL: 'https://deploy.example/hook',
        PUBLISH_WEBHOOK_TOKEN: 't0ken',
      },
      'https://example.com',
      fetch,
    );
    expect(publisher).toBeInstanceOf(CmsPublisher);

    await publisher.publish(post());
    expect(calls.map((c) => c.url)).toEqual([
      'https://cms.example/ingest',
      'https://deploy.example/hook',
    ]);
    expect(calls[0]?.init.headers['authorization']).toBe('Bearer t0ken');
  });

  it('treats a blank PUBLISH_WEBHOOK_URL as unset (dry run)', () => {
    expect(getPublisher({ PUBLISH_WEBHOOK_URL: '   ' }, 'https://example.com')).toBeInstanceOf(
      NoopPublisher,
    );
  });

  it('defaults to global fetch when none is injected', () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(''),
    } as Response);
    const publisher = getPublisher(
      { PUBLISH_WEBHOOK_URL: 'https://cms.example/ingest' },
      'https://example.com',
    );
    return publisher.publish(post()).then(() => {
      expect(spy).toHaveBeenCalledOnce();
      spy.mockRestore();
    });
  });
});
