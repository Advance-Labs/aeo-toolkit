import { describe, expect, it } from 'vitest';
import type { Post } from '../types.js';
import { addDays, duePosts, runScheduler, toIsoDate } from './scheduler.js';

function post(slug: string, overrides: Partial<Post> = {}): Post {
  return {
    slug,
    title: slug,
    primaryKeyword: slug,
    status: 'edited',
    markdown: '',
    fingerprint: [],
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    revisionCount: 0,
    ...overrides,
  };
}

const NOW = () => new Date('2026-06-01T00:00:00.000Z');

describe('date helpers', () => {
  it('adds days across month boundaries in UTC', () => {
    expect(addDays('2026-06-30', 2)).toBe('2026-07-02');
    expect(toIsoDate(new Date('2026-06-15T23:59:59.000Z'))).toBe('2026-06-15');
  });
});

describe('runScheduler', () => {
  it('orders by opportunity score and ramps at the cadence, never colliding', () => {
    const posts = [post('low'), post('high'), post('mid')];
    const scheduled = runScheduler(
      {
        posts,
        cadenceDays: 2,
        opportunityBySlug: { high: 0.9, mid: 0.5, low: 0.1 },
      },
      NOW,
    );
    // start = tomorrow (2026-06-02), cadence 2 days.
    expect(scheduled.map((p) => p.slug)).toEqual(['high', 'mid', 'low']);
    expect(scheduled.map((p) => p.scheduledFor)).toEqual([
      '2026-06-02',
      '2026-06-04',
      '2026-06-06',
    ]);
    expect(scheduled.every((p) => p.status === 'scheduled')).toBe(true);
  });

  it('skips already-occupied publish dates', () => {
    const scheduled = runScheduler(
      {
        posts: [post('a')],
        cadenceDays: 1,
        startDate: '2026-06-10',
        occupiedDates: ['2026-06-10', '2026-06-11'],
      },
      NOW,
    );
    expect(scheduled[0]?.scheduledFor).toBe('2026-06-12');
  });

  it('does not mutate the input posts', () => {
    const input = [post('a')];
    runScheduler({ posts: input, cadenceDays: 1 }, NOW);
    expect(input[0]?.status).toBe('edited');
    expect(input[0]?.scheduledFor).toBeUndefined();
  });
});

describe('duePosts', () => {
  it('returns only scheduled posts on or before the as-of date', () => {
    const posts = [
      post('past', { status: 'scheduled', scheduledFor: '2026-06-01' }),
      post('today', { status: 'scheduled', scheduledFor: '2026-06-03' }),
      post('future', { status: 'scheduled', scheduledFor: '2026-06-10' }),
      post('drafted', { status: 'drafted', scheduledFor: '2026-06-01' }),
    ];
    const due = duePosts(posts, '2026-06-03');
    expect(due.map((p) => p.slug).sort()).toEqual(['past', 'today']);
  });
});
