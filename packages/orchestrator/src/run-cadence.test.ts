import { describe, it, expect } from 'vitest';
import type { ContentProposal, CustomerProfile, LinkOutreachProposal } from '@advance-labs/types';
import { InMemoryProposalStore } from './proposal-store.js';
import { runCadence } from './run-cadence.js';
import type { OrchestratorDeps } from './run-cadence.js';
import type { ContentRunner, ContentRunnerInput } from './content-runner.js';
import type { OutreachRunner, OutreachRunnerInput } from './outreach-runner.js';

function profile(overrides: Partial<CustomerProfile> = {}): CustomerProfile {
  return {
    id: 'c1',
    ownerId: 'o1',
    siteUrl: 'https://example.com',
    niche: 'project management',
    topics: ['kanban'],
    cadence: { articlesPerMonth: 2, outreachPlacementsPerMonth: 1 },
    integrations: {},
    ...overrides,
  };
}

function contentProposal(id: string, p: CustomerProfile): ContentProposal {
  return {
    id,
    customerId: p.id,
    ownerId: p.ownerId,
    kind: 'content',
    status: 'pending',
    createdAt: '2026-06-29T00:00:00.000Z',
    payload: {
      title: id,
      slug: id,
      markdown: `# ${id}\n\nbody`,
      targetQuery: id,
      wordCount: 400,
      confidence: 0.9,
    },
  };
}

function outreachProposal(id: string, p: CustomerProfile): LinkOutreachProposal {
  return {
    id,
    customerId: p.id,
    ownerId: p.ownerId,
    kind: 'link-outreach',
    status: 'pending',
    createdAt: '2026-06-29T00:00:00.000Z',
    payload: {
      prospectUrl: 'https://blog.example.org/write-for-us',
      prospectDomain: 'blog.example.org',
      outreachSubject: 's',
      outreachBody: 'b',
    },
  };
}

/** Stub runners that record their inputs and return fixed proposals. */
function makeDeps(store: InMemoryProposalStore) {
  const contentCalls: ContentRunnerInput[] = [];
  const outreachCalls: OutreachRunnerInput[] = [];
  const content: ContentRunner = {
    run: (input) => {
      contentCalls.push(input);
      return Promise.resolve([
        contentProposal(`art_${contentCalls.length}_1`, input.profile),
        contentProposal(`art_${contentCalls.length}_2`, input.profile),
      ]);
    },
  };
  const outreach: OutreachRunner = {
    run: (input) => {
      outreachCalls.push(input);
      return Promise.resolve([outreachProposal(`out_${outreachCalls.length}`, input.profile)]);
    },
  };
  const deps: OrchestratorDeps = {
    store,
    clock: () => new Date('2026-06-29T12:00:00.000Z'),
    content,
    outreach,
  };
  return { deps, contentCalls, outreachCalls };
}

describe('runCadence', () => {
  it('runs each due job, writes proposals, and returns one JobResult per in-cadence kind', async () => {
    const store = new InMemoryProposalStore();
    const { deps, contentCalls, outreachCalls } = makeDeps(store);
    const results = await runCadence(profile(), deps);

    expect(results).toHaveLength(2);
    const content = results.find((r) => r.jobKind === 'content.generate')!;
    const outreach = results.find((r) => r.jobKind === 'link.outreach')!;
    expect(content).toMatchObject({ customerId: 'c1', period: '2026-06', proposalsCreated: 2, skipped: false });
    expect(outreach).toMatchObject({ proposalsCreated: 1, skipped: false });

    // Runners were invoked with the cadence target as the limit.
    expect(contentCalls[0]!.limit).toBe(2);
    expect(outreachCalls[0]!.limit).toBe(1);

    // Proposals landed in the store.
    expect(await store.listByCustomer('c1')).toHaveLength(3);
  });

  it('passes a 28-day GSC lookback window to the content runner', async () => {
    const store = new InMemoryProposalStore();
    const { deps, contentCalls } = makeDeps(store);
    await runCadence(profile(), deps);
    expect(contentCalls[0]!.endDate).toBe('2026-06-29');
    expect(contentCalls[0]!.startDate).toBe('2026-06-01');
  });

  it('is idempotent: a second run in the same period creates nothing and skips', async () => {
    const store = new InMemoryProposalStore();
    const { deps, contentCalls, outreachCalls } = makeDeps(store);
    await runCadence(profile(), deps);
    const second = await runCadence(profile(), deps);

    expect(second.every((r) => r.skipped)).toBe(true);
    expect(second.every((r) => r.proposalsCreated === 0)).toBe(true);
    expect(second.find((r) => r.jobKind === 'content.generate')!.reason).toBe('already-ran-this-period');
    // Runners not invoked again; store not doubled.
    expect(contentCalls).toHaveLength(1);
    expect(outreachCalls).toHaveLength(1);
    expect(await store.listByCustomer('c1')).toHaveLength(3);
  });

  it('only runs kinds that are in the customer’s cadence', async () => {
    const store = new InMemoryProposalStore();
    const { deps, outreachCalls } = makeDeps(store);
    const results = await runCadence(
      profile({ cadence: { articlesPerMonth: 1, outreachPlacementsPerMonth: 0 } }),
      deps,
    );
    expect(results.map((r) => r.jobKind)).toEqual(['content.generate']);
    expect(outreachCalls).toHaveLength(0);
  });
});
