import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  comparePeriodsShape,
  ga4RunReportShape,
  gscCtrGapsShape,
  gscSearchAnalyticsShape,
  gscTopQueriesShape,
} from './schemas.js';

describe('ga4RunReportShape', () => {
  const schema = z.object(ga4RunReportShape);

  it('accepts a valid report request and defaults dimensions to []', () => {
    const parsed = schema.parse({
      propertyId: '123',
      dateRanges: [{ startDate: '2024-01-01', endDate: '2024-01-31' }],
      metrics: ['totalUsers'],
    });
    expect(parsed.dimensions).toEqual([]);
  });

  it('rejects a bad date format', () => {
    expect(() =>
      schema.parse({
        propertyId: '1',
        dateRanges: [{ startDate: '2024/01/01', endDate: '2024-01-31' }],
        metrics: ['totalUsers'],
      }),
    ).toThrow();
  });

  it('requires at least one metric', () => {
    expect(() =>
      schema.parse({
        propertyId: '1',
        dateRanges: [{ startDate: '2024-01-01', endDate: '2024-01-31' }],
        metrics: [],
      }),
    ).toThrow();
  });
});

describe('gscSearchAnalyticsShape', () => {
  const schema = z.object(gscSearchAnalyticsShape);

  it('validates dimension enum membership', () => {
    expect(() =>
      schema.parse({
        siteUrl: 'https://x.com/',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        dimensions: ['not-a-dimension'],
      }),
    ).toThrow();
  });

  it('accepts known dimensions', () => {
    const parsed = schema.parse({
      siteUrl: 'https://x.com/',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      dimensions: ['query', 'page'],
    });
    expect(parsed.dimensions).toEqual(['query', 'page']);
  });
});

describe('convenience tool defaults', () => {
  it('gsc_top_queries defaults days=28 and limit=25', () => {
    const parsed = z.object(gscTopQueriesShape).parse({ siteUrl: 'https://x.com/' });
    expect(parsed.days).toBe(28);
    expect(parsed.limit).toBe(25);
  });

  it('gsc_ctr_gaps applies CTR + impression defaults', () => {
    const parsed = z.object(gscCtrGapsShape).parse({ siteUrl: 'https://x.com/' });
    expect(parsed.maxCtr).toBe(0.02);
    expect(parsed.minImpressions).toBe(100);
  });

  it('compare_periods requires both ranges', () => {
    expect(() =>
      z.object(comparePeriodsShape).parse({
        siteUrl: 'https://x.com/',
        rangeA: { startDate: '2024-01-01', endDate: '2024-01-31' },
      }),
    ).toThrow();
  });
});
