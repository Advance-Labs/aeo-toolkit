import { describe, expect, it, vi } from 'vitest';
import type { Ga4Report, Ga4ReportRequest, GscQueryRequest, GscReport } from '@aeo/types';
import type { Ga4ReportFn } from '../google/ga4.js';
import type { GscQueryFn } from '../google/gsc.js';
import type { Post } from '../types.js';
import { healthScore, normalizePath, postPath, runMonitor } from './monitor.js';

function post(slug: string, status: Post['status'] = 'published'): Post {
  return {
    slug,
    title: slug,
    primaryKeyword: slug,
    status,
    markdown: '',
    fingerprint: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    revisionCount: 0,
  };
}

const NOW = () => new Date('2026-06-03T00:00:00.000Z');

describe('normalizePath', () => {
  it('strips origin, query, hash, and trailing slash', () => {
    expect(normalizePath('https://example.com/blog/post/?utm=1#x')).toBe('/blog/post');
    expect(normalizePath('/blog/post')).toBe('/blog/post');
    expect(normalizePath('https://example.com/')).toBe('/');
  });
});

describe('postPath', () => {
  it('derives the canonical /blog/<slug> path', () => {
    expect(postPath(post('my-post'))).toBe('/blog/my-post');
  });
});

describe('healthScore', () => {
  it('is 0 when there is no traffic at all', () => {
    expect(healthScore({ clicks: 0, impressions: 0, ctr: 0, position: 0, pageViews: 0 })).toBe(0);
  });

  it('rewards clicks and good position', () => {
    const strong = healthScore({
      clicks: 80,
      impressions: 1000,
      ctr: 0.08,
      position: 1.5,
      pageViews: 200,
    });
    const weak = healthScore({
      clicks: 1,
      impressions: 1000,
      ctr: 0.001,
      position: 40,
      pageViews: 2,
    });
    expect(strong).toBeGreaterThan(weak);
    expect(strong).toBeLessThanOrEqual(1);
    expect(weak).toBeGreaterThanOrEqual(0);
  });
});

describe('runMonitor', () => {
  it('joins GSC + GA4 onto published posts and leaves non-published untouched', async () => {
    const posts = [post('live'), post('draft', 'drafted')];

    const gscByPage: GscReport = {
      rows: [
        {
          keys: ['https://example.com/blog/live'],
          clicks: 20,
          impressions: 800,
          ctr: 0.025,
          position: 3,
        },
      ],
    };
    const ga4Report: Ga4Report = {
      rows: [{ dimensions: { pagePath: '/blog/live' }, metrics: { screenPageViews: 150 } }],
      rowCount: 1,
    };

    let gscReq: GscQueryRequest | undefined;
    let ga4Req: Ga4ReportRequest | undefined;
    const gscQuery: GscQueryFn = vi.fn((req): Promise<GscReport> => {
      gscReq = req;
      return Promise.resolve(gscByPage);
    });
    const ga4Fn: Ga4ReportFn = vi.fn((req): Promise<Ga4Report> => {
      ga4Req = req;
      return Promise.resolve(ga4Report);
    });

    const out = await runMonitor(
      {
        posts,
        gscSiteUrl: 'https://example.com/',
        ga4PropertyId: '123',
        startDate: '2026-05-06',
        endDate: '2026-06-03',
      },
      gscQuery,
      ga4Fn,
      NOW,
    );

    expect(gscReq?.dimensions).toEqual(['page']);
    expect(ga4Req?.metrics).toEqual(['screenPageViews']);

    const live = out.find((p) => p.slug === 'live');
    const draft = out.find((p) => p.slug === 'draft');
    expect(live?.health?.clicks).toBe(20);
    expect(live?.health?.pageViews).toBe(150);
    expect(live?.health?.score).toBeGreaterThan(0);
    expect(draft?.health).toBeUndefined();
  });

  it('scores a published post with no matching data as 0 (self-correction candidate)', async () => {
    const out = await runMonitor(
      {
        posts: [post('orphan')],
        gscSiteUrl: 'https://example.com/',
        ga4PropertyId: '123',
        startDate: '2026-05-06',
        endDate: '2026-06-03',
      },
      () => Promise.resolve({ rows: [] }),
      () => Promise.resolve({ rows: [], rowCount: 0 }),
      NOW,
    );
    expect(out[0]?.health?.score).toBe(0);
  });
});
