import { describe, it, expect, vi } from 'vitest';
import type { CustomerProfile, SafeFetchResult } from '@aeo/types';
import { OutreachRunnerImpl, draftOutreachEmail } from './outreach-runner.js';
import type { DiscoverFn, SafeFetchFn } from './outreach-runner.js';

function profile(overrides: Partial<CustomerProfile> = {}): CustomerProfile {
  return {
    id: 'c1',
    ownerId: 'o1',
    siteUrl: 'https://acme.example',
    niche: 'project management software',
    topics: ['kanban', 'sprints'],
    cadence: { articlesPerMonth: 4, outreachPlacementsPerMonth: 2 },
    integrations: {},
    ...overrides,
  };
}

const discover: DiscoverFn = () =>
  Promise.resolve({
    results: [
      { title: 'PM Blog', url: 'https://pmblog.example/write-for-us', snippet: '' },
      { title: 'Agile Hub', url: 'https://agilehub.example/contribute', snippet: '' },
    ],
    warnings: [],
  });

function okResult(url: string, body: string): SafeFetchResult {
  return { ok: true, status: 200, url, body };
}

function makeRunner(safeFetch: SafeFetchFn) {
  let n = 0;
  return new OutreachRunnerImpl({
    discover,
    safeFetch,
    now: () => new Date('2026-06-29T00:00:00.000Z'),
    newId: () => `op_${++n}`,
  });
}

describe('OutreachRunnerImpl.run', () => {
  it('fetches each prospect through the injected safeFetch (SSRF seam) and drafts a proposal', async () => {
    const safeFetch = vi.fn<SafeFetchFn>((url) =>
      Promise.resolve(
        okResult(
          url,
          '<html><body>Contact us at <a href="mailto:editor@pmblog.example">editor</a></body></html>',
        ),
      ),
    );
    const runner = makeRunner(safeFetch);
    const proposals = await runner.run({ profile: profile(), period: '2026-06', limit: 1 });

    expect(safeFetch).toHaveBeenCalled();
    expect(safeFetch.mock.calls[0]![0]).toBe('https://pmblog.example/write-for-us');

    expect(proposals).toHaveLength(1);
    const p = proposals[0]!;
    expect(p.kind).toBe('link-outreach');
    expect(p.status).toBe('pending');
    expect(p.customerId).toBe('c1');
    expect(p.ownerId).toBe('o1');
    expect(p.payload.prospectUrl).toBe('https://pmblog.example/write-for-us');
    expect(p.payload.prospectDomain).toBe('pmblog.example');
    expect(p.payload.contactEmail).toBe('editor@pmblog.example');
    // The only URL in the body is the customer's own agreed target — never a model/prospect URL.
    expect(p.payload.outreachBody).toContain('https://acme.example');
    expect(p.payload.outreachBody).not.toContain('pmblog.example/write-for-us');
  });

  it('skips a prospect the SSRF guard blocks (never fabricates a proposal for it)', async () => {
    const safeFetch = vi.fn<SafeFetchFn>((url) =>
      Promise.resolve(
        url.includes('pmblog')
          ? ({ ok: false, status: 0, url, body: '', blockedReason: 'private-address' } as SafeFetchResult)
          : okResult(url, '<html><body>hi editor@agilehub.example</body></html>'),
      ),
    );
    const runner = makeRunner(safeFetch);
    const proposals = await runner.run({ profile: profile(), period: '2026-06', limit: 5 });

    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.payload.prospectDomain).toBe('agilehub.example');
  });

  it('respects the placement limit', async () => {
    const safeFetch: SafeFetchFn = (url) => Promise.resolve(okResult(url, '<html>no contacts here</html>'));
    const runner = makeRunner(safeFetch);
    const proposals = await runner.run({ profile: profile(), period: '2026-06', limit: 1 });
    expect(proposals).toHaveLength(1);
  });

  it('still drafts a proposal when no contact email is found (human can follow up)', async () => {
    const safeFetch: SafeFetchFn = (url) => Promise.resolve(okResult(url, '<html>no email</html>'));
    const runner = makeRunner(safeFetch);
    const proposals = await runner.run({ profile: profile(), period: '2026-06', limit: 1 });
    expect(proposals[0]!.payload.contactEmail).toBeUndefined();
  });
});

describe('draftOutreachEmail', () => {
  it('uses the customer site as the single anchor and never the prospect URL', () => {
    const email = draftOutreachEmail(profile(), 'pmblog.example');
    expect(email.subject).toContain('acme.example');
    expect(email.body).toContain('https://acme.example');
    expect(email.body).toContain('pmblog.example');
    // No raw prospect deep-link / no model-derived target.
    expect(email.body).not.toContain('/write-for-us');
  });
});
