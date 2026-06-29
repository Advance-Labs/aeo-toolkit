import { describe, it, expect } from 'vitest';
import type { ContentProposal, LinkOutreachProposal, Proposal } from '@aeo/types';
import { InMemoryProposalStore } from './proposal-store.js';
import { dedupeKey } from './cadence.js';

function content(id: string, slug: string): ContentProposal {
  return {
    id,
    customerId: 'c1',
    ownerId: 'o1',
    kind: 'content',
    status: 'pending',
    createdAt: '2026-06-29T00:00:00.000Z',
    payload: {
      title: slug,
      slug,
      markdown: `# ${slug}\n\nbody`,
      targetQuery: slug,
      wordCount: 400,
      confidence: 0.9,
    },
  };
}

function outreach(id: string, domain: string): LinkOutreachProposal {
  return {
    id,
    customerId: 'c1',
    ownerId: 'o1',
    kind: 'link-outreach',
    status: 'pending',
    createdAt: '2026-06-29T00:00:00.000Z',
    payload: {
      prospectUrl: `https://${domain}/write-for-us`,
      prospectDomain: domain,
      outreachSubject: 'Collaboration',
      outreachBody: 'Hello',
    },
  };
}

const contentKey = dedupeKey('c1', 'content.generate', '2026-06');

describe('InMemoryProposalStore.createForJob', () => {
  it('persists a batch and reports created:true', async () => {
    const store = new InMemoryProposalStore();
    const res = await store.createForJob(contentKey, [content('p1', 'a'), content('p2', 'b')]);
    expect(res.created).toBe(true);
    expect(res.proposals).toHaveLength(2);
    expect(await store.listByCustomer('c1')).toHaveLength(2);
  });

  it('is idempotent on the dedupe key: a second call creates nothing', async () => {
    const store = new InMemoryProposalStore();
    await store.createForJob(contentKey, [content('p1', 'a')]);
    const second = await store.createForJob(contentKey, [content('p9', 'z')]);
    expect(second.created).toBe(false);
    expect(second.proposals.map((p) => p.id)).toEqual(['p1']);
    expect(await store.listByCustomer('c1')).toHaveLength(1);
  });

  it('records the job dedupe key for the period (drives dueJobs)', async () => {
    const store = new InMemoryProposalStore();
    await store.createForJob(contentKey, [content('p1', 'a')]);
    await store.createForJob(dedupeKey('c1', 'link.outreach', '2026-06'), [outreach('p2', 'x.org')]);
    const keys = await store.jobKeysForPeriod('c1', '2026-06');
    expect(keys).toEqual(new Set([contentKey, 'c1:link.outreach:2026-06']));
    // A different period sees nothing.
    expect(await store.jobKeysForPeriod('c1', '2026-07')).toEqual(new Set());
  });
});

describe('InMemoryProposalStore reads', () => {
  it('gets by id and returns null for a miss', async () => {
    const store = new InMemoryProposalStore();
    await store.createForJob(contentKey, [content('p1', 'a')]);
    expect((await store.get('p1'))?.id).toBe('p1');
    expect(await store.get('nope')).toBeNull();
  });

  it('lists by status, scoped to the customer', async () => {
    const store = new InMemoryProposalStore();
    await store.createForJob(contentKey, [content('p1', 'a'), content('p2', 'b')]);
    await store.setStatus('p2', { status: 'approved', decidedBy: 'staff', decidedAt: 'now' });
    const pending = await store.listByStatus('c1', 'pending');
    expect(pending.map((p) => p.id)).toEqual(['p1']);
    const approved = await store.listByStatus('c1', 'approved');
    expect(approved.map((p) => p.id)).toEqual(['p2']);
  });

  it('does not leak another customer’s rows', async () => {
    const store = new InMemoryProposalStore();
    const foreign: Proposal = { ...content('px', 'a'), customerId: 'c2', ownerId: 'o2' };
    await store.createForJob(dedupeKey('c2', 'content.generate', '2026-06'), [foreign]);
    await store.createForJob(contentKey, [content('p1', 'a')]);
    expect((await store.listByCustomer('c1')).map((p) => p.id)).toEqual(['p1']);
  });
});

describe('InMemoryProposalStore.setStatus / delete', () => {
  it('updates status + decision fields', async () => {
    const store = new InMemoryProposalStore();
    await store.createForJob(contentKey, [content('p1', 'a')]);
    const updated = await store.setStatus('p1', {
      status: 'executed',
      decidedBy: 'staff_1',
      decidedAt: '2026-06-29T01:00:00.000Z',
    });
    expect(updated.status).toBe('executed');
    expect(updated.decidedBy).toBe('staff_1');
    expect((await store.get('p1'))?.status).toBe('executed');
  });

  it('throws when updating an unknown id', async () => {
    const store = new InMemoryProposalStore();
    await expect(store.setStatus('ghost', { status: 'approved' })).rejects.toThrow();
  });

  it('deletes by id', async () => {
    const store = new InMemoryProposalStore();
    await store.createForJob(contentKey, [content('p1', 'a')]);
    expect(await store.delete('p1')).toBe(true);
    expect(await store.delete('p1')).toBe(false);
    expect(await store.listByCustomer('c1')).toHaveLength(0);
  });

  it('returns deep copies so external mutation cannot corrupt the store', async () => {
    const store = new InMemoryProposalStore();
    await store.createForJob(contentKey, [content('p1', 'a')]);
    const got = (await store.get('p1')) as ContentProposal;
    got.payload.confidence = 0;
    expect(((await store.get('p1')) as ContentProposal).payload.confidence).toBe(0.9);
  });
});
