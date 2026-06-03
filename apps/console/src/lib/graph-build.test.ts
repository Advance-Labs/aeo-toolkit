import { describe, expect, it, vi } from 'vitest';
import type { BacklinkGraph, BuildBacklinkGraphOptions, HttpClient } from '@aeo/backlinks';
import type * as BacklinksModule from '@aeo/backlinks';
import { buildGraph, DEFAULT_BACKLINK_GRAPH_LIMIT, type GraphBuilder } from './graph-build.js';

// Keep the live/rate-limited HTTP client factories network-free in tests: the
// engine builder is injected directly, so these only need to return a typed stub.
vi.mock('@aeo/backlinks', async (importOriginal) => {
  const actual = await importOriginal<typeof BacklinksModule>();
  const stubHttp: HttpClient = {
    getText: () => Promise.resolve({ ok: false, status: 0, body: '', url: '' }),
    getResource: () => Promise.reject(new Error('no network in tests')),
  };
  return {
    ...actual,
    createLiveHttpClient: vi.fn(() => stubHttp),
    createRateLimitedHttpClient: vi.fn(() => stubHttp),
    // Default engine is never reached: every test passes an injected builder.
    buildBacklinkGraph: vi.fn(() => Promise.reject(new Error('real engine must not run'))),
  };
});

/** A minimal graph the fake builder returns, echoing back the root url. */
function fakeGraph(rootUrl: string): BacklinkGraph {
  return {
    root: { id: `root:${rootUrl}`, type: 'root', domain: 'acme.com', url: rootUrl },
    nodes: [{ id: `root:${rootUrl}`, type: 'root', domain: 'acme.com', url: rootUrl }],
    edges: [],
    stats: { referringDomains: 0, backlinks: 0, dofollowRatio: 0, topSources: [], sampled: true },
  };
}

describe('buildGraph', () => {
  it('forwards the explicit opts.limit to the engine', async () => {
    const calls: BuildBacklinkGraphOptions[] = [];
    const builder: GraphBuilder = (url, opts) => {
      calls.push(opts ?? {});
      return Promise.resolve(fakeGraph(url));
    };

    await buildGraph('https://acme.com/', { limit: 7 }, builder, {});

    expect(calls).toHaveLength(1);
    expect(calls[0]?.limit).toBe(7);
  });

  it('falls back to BACKLINK_GRAPH_LIMIT from env when opts has no limit', async () => {
    const calls: BuildBacklinkGraphOptions[] = [];
    const builder: GraphBuilder = (url, opts) => {
      calls.push(opts ?? {});
      return Promise.resolve(fakeGraph(url));
    };

    await buildGraph('https://acme.com/', {}, builder, { BACKLINK_GRAPH_LIMIT: '40' });

    expect(calls[0]?.limit).toBe(40);
  });

  it('defaults the limit when neither opts nor env supplies one', async () => {
    const calls: BuildBacklinkGraphOptions[] = [];
    const builder: GraphBuilder = (url, opts) => {
      calls.push(opts ?? {});
      return Promise.resolve(fakeGraph(url));
    };

    await buildGraph('https://acme.com/', {}, builder, {});

    expect(calls[0]?.limit).toBe(DEFAULT_BACKLINK_GRAPH_LIMIT);
  });

  it('ignores a non-positive or non-numeric env limit and uses the default', async () => {
    const calls: BuildBacklinkGraphOptions[] = [];
    const builder: GraphBuilder = (url, opts) => {
      calls.push(opts ?? {});
      return Promise.resolve(fakeGraph(url));
    };

    await buildGraph('https://acme.com/', {}, builder, { BACKLINK_GRAPH_LIMIT: 'abc' });
    await buildGraph('https://acme.com/', {}, builder, { BACKLINK_GRAPH_LIMIT: '0' });

    expect(calls[0]?.limit).toBe(DEFAULT_BACKLINK_GRAPH_LIMIT);
    expect(calls[1]?.limit).toBe(DEFAULT_BACKLINK_GRAPH_LIMIT);
  });

  it('forwards COMMONCRAWL_INDEX from env when set', async () => {
    const calls: BuildBacklinkGraphOptions[] = [];
    const builder: GraphBuilder = (url, opts) => {
      calls.push(opts ?? {});
      return Promise.resolve(fakeGraph(url));
    };

    await buildGraph('https://acme.com/', {}, builder, {
      COMMONCRAWL_INDEX: 'CC-MAIN-2024-51-index',
    });

    expect(calls[0]?.commonCrawlIndex).toBe('CC-MAIN-2024-51-index');
  });

  it('omits commonCrawlIndex when the env var is unset or blank', async () => {
    const calls: BuildBacklinkGraphOptions[] = [];
    const builder: GraphBuilder = (url, opts) => {
      calls.push(opts ?? {});
      return Promise.resolve(fakeGraph(url));
    };

    await buildGraph('https://acme.com/', {}, builder, { COMMONCRAWL_INDEX: '   ' });
    await buildGraph('https://acme.com/', {}, builder, {});

    expect(calls[0]?.commonCrawlIndex).toBeUndefined();
    expect(calls[1]?.commonCrawlIndex).toBeUndefined();
  });

  it('injects a rate-limited http client into the engine options', async () => {
    let received: BuildBacklinkGraphOptions | undefined;
    const builder: GraphBuilder = (url, opts) => {
      received = opts;
      return Promise.resolve(fakeGraph(url));
    };

    await buildGraph('https://acme.com/', {}, builder, {});

    expect(received?.http).toBeDefined();
  });

  it('returns the engine result unchanged (maps the BacklinkGraph through)', async () => {
    const builder: GraphBuilder = (url) => Promise.resolve(fakeGraph(url));

    const graph = await buildGraph('https://acme.com/', {}, builder, {});

    expect(graph.root.url).toBe('https://acme.com/');
    expect(graph.stats.sampled).toBe(true);
  });

  it('propagates an engine rejection to the caller (route maps it to build_failed)', async () => {
    const builder: GraphBuilder = () => Promise.reject(new Error('all sources down'));

    await expect(buildGraph('https://acme.com/', {}, builder, {})).rejects.toThrow(
      'all sources down',
    );
  });
});
