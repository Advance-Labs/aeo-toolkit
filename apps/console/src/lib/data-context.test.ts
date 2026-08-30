import { describe, expect, it } from 'vitest';
import type { Ga4Report, GscReport } from '@advance-labs/types';
import { buildDataContext, formatGa4Table, formatGscTable } from './data-context.js';

const gsc: GscReport = {
  rows: [
    { keys: ['cheap shoes', '/shoes'], clicks: 5, impressions: 1000, ctr: 0.005, position: 8.4 },
    { keys: ['running shoes', '/run'], clicks: 50, impressions: 200, ctr: 0.25, position: 2.1 },
  ],
};

const ga4: Ga4Report = {
  rowCount: 2,
  rows: [
    {
      dimensions: { pagePath: '/shoes', deviceCategory: 'mobile', country: 'United States' },
      metrics: { screenPageViews: 1200, totalUsers: 800, engagementRate: 0.42 },
    },
    {
      dimensions: { pagePath: '/run', deviceCategory: 'desktop', country: 'Canada' },
      metrics: { screenPageViews: 300, totalUsers: 210, engagementRate: 0.78 },
    },
  ],
};

describe('formatGscTable', () => {
  it('sorts by impressions desc and formats ctr as a percentage', () => {
    const table = formatGscTable(gsc, ['query', 'page']);
    const lines = table.split('\n');
    expect(lines[0]).toBe('query | page | clicks | impressions | ctr | avgPosition');
    // Highest impressions (1000) row leads.
    expect(lines[1]).toContain('cheap shoes');
    expect(lines[1]).toContain('0.5%');
    expect(lines[2]).toContain('running shoes');
    expect(lines[2]).toContain('25%');
  });

  it('respects the topN limit', () => {
    const table = formatGscTable(gsc, ['query', 'page'], 1);
    expect(table.split('\n')).toHaveLength(2); // header + 1 row
  });

  it('handles an empty report', () => {
    expect(formatGscTable({ rows: [] }, ['query'])).toMatch(/No Search Console rows/);
  });
});

describe('formatGa4Table', () => {
  it('discovers columns from the first row and renders metrics', () => {
    const table = formatGa4Table(ga4);
    const lines = table.split('\n');
    expect(lines[0]).toBe(
      'pagePath | deviceCategory | country | screenPageViews | totalUsers | engagementRate',
    );
    expect(lines[1]).toContain('/shoes');
    expect(lines[1]).toContain('1200');
  });

  it('handles an empty report', () => {
    expect(formatGa4Table({ rows: [], rowCount: 0 })).toMatch(/No GA4 rows/);
  });
});

describe('buildDataContext', () => {
  it('includes the date window, both tables, and the identifiers', () => {
    const ctx = buildDataContext({
      propertyId: '123',
      siteUrl: 'https://example.com/',
      startDate: '2024-01-01',
      endDate: '2024-01-28',
      ga4,
      gsc,
      gscDimensions: ['query', 'page'],
    });
    expect(ctx).toContain('Date range: 2024-01-01 to 2024-01-28');
    expect(ctx).toContain('GA4 property: 123');
    expect(ctx).toContain('Search Console site: https://example.com/');
    expect(ctx).toContain('## Google Search Console');
    expect(ctx).toContain('## Google Analytics 4');
    expect(ctx).toContain('cheap shoes');
    expect(ctx).toContain('/shoes');
  });

  it('notes when a source is unavailable', () => {
    const ctx = buildDataContext({
      propertyId: '123',
      siteUrl: 'https://example.com/',
      startDate: '2024-01-01',
      endDate: '2024-01-28',
      gscDimensions: ['query'],
    });
    expect(ctx).toContain('Search Console data unavailable.');
    expect(ctx).toContain('GA4 data unavailable.');
  });
});
