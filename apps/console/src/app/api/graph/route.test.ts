import { describe, expect, it, vi } from 'vitest';
import type { BacklinkGraph } from '@advance-labs/backlinks';

// Mock the build seam so the route is exercised without any network or real engine.
// The route imports `buildGraph` from `@/lib/graph-build`, so the mock must target that exact
// specifier. `vi.mock` is hoisted above this module, so the shared mock is created via
// `vi.hoisted` to exist when the factory runs.
const { buildGraphMock } = vi.hoisted(() => ({
  buildGraphMock: vi.fn<(url: string) => Promise<BacklinkGraph>>(),
}));
vi.mock('@/lib/graph-build', () => ({
  buildGraph: (url: string): Promise<BacklinkGraph> => buildGraphMock(url),
}));

const { POST } = await import('./route.js');

function postRequest(body: string): Request {
  return new Request('https://graph.example/api/graph', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
}

function sampleGraph(): BacklinkGraph {
  return {
    root: { id: 'root:acme.com', type: 'root', domain: 'acme.com', url: 'https://acme.com/' },
    nodes: [
      { id: 'root:acme.com', type: 'root', domain: 'acme.com', url: 'https://acme.com/' },
      { id: 'ref.io', type: 'referring-domain', domain: 'ref.io' },
    ],
    edges: [{ source: 'root:acme.com', target: 'ref.io', kind: 'mention', dofollow: false }],
    stats: {
      referringDomains: 1,
      backlinks: 1,
      dofollowRatio: 0,
      topSources: [{ domain: 'ref.io', count: 1 }],
      sampled: true,
    },
  };
}

describe('POST /api/graph', () => {
  it('returns the assembled graph as JSON on a valid request', async () => {
    buildGraphMock.mockResolvedValueOnce(sampleGraph());

    const res = await POST(postRequest(JSON.stringify({ url: 'acme.com' })));

    expect(res.status).toBe(200);
    const json = (await res.json()) as BacklinkGraph;
    expect(json.stats.sampled).toBe(true);
    expect(json.nodes).toHaveLength(2);
    // The validated, normalized URL is what reaches the builder.
    expect(buildGraphMock).toHaveBeenCalledWith('https://acme.com/');
  });

  it('returns 400 invalid_request for non-JSON bodies', async () => {
    const res = await POST(postRequest('not json'));

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('invalid_request');
  });

  it('returns 400 invalid_request when the url field is missing', async () => {
    const res = await POST(postRequest(JSON.stringify({})));

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe('invalid_request');
  });

  it('returns 502 build_failed (never a silent 200) when the engine throws', async () => {
    buildGraphMock.mockRejectedValueOnce(new Error('all sources down'));

    const res = await POST(postRequest(JSON.stringify({ url: 'acme.com' })));

    expect(res.status).toBe(502);
    const json = (await res.json()) as { error: { code: string; message: string } };
    expect(json.error.code).toBe('build_failed');
    expect(json.error.message).toBe('all sources down');
  });
});
