import { describe, it, expect } from 'vitest';
import type { CustomerProfile } from '@advance-labs/types';
import { dedupeKey, periodOf, dueJobs, inCadenceKinds } from './cadence.js';

function profile(overrides: Partial<CustomerProfile> = {}): CustomerProfile {
  return {
    id: 'cust_1',
    ownerId: 'owner_1',
    siteUrl: 'https://example.com',
    niche: 'project management software',
    topics: ['kanban', 'sprint planning'],
    cadence: { articlesPerMonth: 4, outreachPlacementsPerMonth: 2 },
    integrations: {},
    ...overrides,
  };
}

describe('periodOf', () => {
  it('formats a Date as YYYY-MM in UTC', () => {
    expect(periodOf(new Date('2026-06-29T23:30:00.000Z'))).toBe('2026-06');
    expect(periodOf(new Date('2026-01-01T00:00:00.000Z'))).toBe('2026-01');
    expect(periodOf(new Date('2026-12-31T23:59:59.999Z'))).toBe('2026-12');
  });
});

describe('dedupeKey', () => {
  it('joins customer + jobKind + period', () => {
    expect(dedupeKey('cust_1', 'content.generate', '2026-06')).toBe(
      'cust_1:content.generate:2026-06',
    );
    expect(dedupeKey('cust_1', 'link.outreach', '2026-06')).toBe('cust_1:link.outreach:2026-06');
  });
});

describe('inCadenceKinds', () => {
  it('includes only kinds with a positive monthly target', () => {
    expect(inCadenceKinds(profile())).toEqual([
      { jobKind: 'content.generate', target: 4 },
      { jobKind: 'link.outreach', target: 2 },
    ]);
  });

  it('drops a kind whose target is zero', () => {
    expect(inCadenceKinds(profile({ cadence: { articlesPerMonth: 3, outreachPlacementsPerMonth: 0 } }))).toEqual(
      [{ jobKind: 'content.generate', target: 3 }],
    );
  });

  it('returns nothing when both targets are zero', () => {
    expect(inCadenceKinds(profile({ cadence: { articlesPerMonth: 0, outreachPlacementsPerMonth: 0 } }))).toEqual(
      [],
    );
  });
});

describe('dueJobs', () => {
  const period = '2026-06';

  it('returns both jobs when nothing has run this period', () => {
    const jobs = dueJobs(profile(), period, new Set());
    expect(jobs.map((j) => j.jobKind)).toEqual(['content.generate', 'link.outreach']);
    expect(jobs[0]).toMatchObject({
      jobKind: 'content.generate',
      period,
      dedupeKey: 'cust_1:content.generate:2026-06',
      target: 4,
    });
  });

  it('omits a kind whose monthly target is zero', () => {
    const jobs = dueJobs(
      profile({ cadence: { articlesPerMonth: 0, outreachPlacementsPerMonth: 2 } }),
      period,
      new Set(),
    );
    expect(jobs.map((j) => j.jobKind)).toEqual(['link.outreach']);
  });

  it('is idempotent: a job whose dedupe key already exists is not due', () => {
    const existing = new Set(['cust_1:content.generate:2026-06']);
    const jobs = dueJobs(profile(), period, existing);
    expect(jobs.map((j) => j.jobKind)).toEqual(['link.outreach']);
  });

  it('returns no jobs when every kind already ran this period', () => {
    const existing = new Set([
      'cust_1:content.generate:2026-06',
      'cust_1:link.outreach:2026-06',
    ]);
    expect(dueJobs(profile(), period, existing)).toEqual([]);
  });

  it('keys idempotency by period, so a new period re-opens the jobs', () => {
    const existing = new Set(['cust_1:content.generate:2026-05']);
    const jobs = dueJobs(profile(), '2026-06', existing);
    expect(jobs.map((j) => j.jobKind)).toEqual(['content.generate', 'link.outreach']);
  });
});
