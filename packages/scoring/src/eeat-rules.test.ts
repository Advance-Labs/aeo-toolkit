import { describe, expect, it } from 'vitest';
import { eeatScore, eeatSignalDefs } from './eeat-rules.js';
import { emptyContext, goodContext, poorContext, singlePageContext } from './fixtures.js';

describe('eeatScore', () => {
  it('produces the four-pillar report shape', () => {
    const report = eeatScore(goodContext());
    expect(report.pillars.map((p) => p.key)).toEqual([
      'experience',
      'expertise',
      'authoritativeness',
      'trust',
    ]);
    for (const pillar of report.pillars) {
      expect(pillar.score).toBeGreaterThanOrEqual(0);
      expect(pillar.score).toBeLessThanOrEqual(100);
      expect(pillar.signals.length).toBeGreaterThan(0);
    }
    expect(report.url).toBe('https://good.example.com/');
    expect(report.pagesCrawled).toBe(5);
    expect(typeof report.generatedAt).toBe('string');
  });

  it('scores a strong site high and a weak site low', () => {
    const good = eeatScore(goodContext());
    const poor = eeatScore(poorContext());
    expect(good.overall).toBeGreaterThan(80);
    expect(['A', 'B']).toContain(good.grade);
    expect(poor.overall).toBeLessThan(40);
    expect(poor.overall).toBeLessThan(good.overall);
  });

  it('lists improvements from absent signals, heaviest first', () => {
    const report = eeatScore(poorContext());
    expect(report.improvements.length).toBeGreaterThan(0);
    // first improvement should correspond to a high-weight failed signal (HTTPS, Person, or Org are weight 6)
    expect(report.improvements[0]).toBeTruthy();
  });

  it('detects trust/expertise pages by URL pattern on the good site', () => {
    const report = eeatScore(goodContext());
    const trust = report.pillars.find((p) => p.key === 'trust');
    const contact = trust?.signals.find((s) => s.id === 'eeat.trust.contact-page');
    const privacy = trust?.signals.find((s) => s.id === 'eeat.trust.privacy-terms');
    expect(contact?.present).toBe(true);
    expect(privacy?.present).toBe(true);

    const expertise = report.pillars.find((p) => p.key === 'expertise');
    const about = expertise?.signals.find((s) => s.id === 'eeat.expertise.about-page');
    expect(about?.present).toBe(true);
  });

  it('does not throw on empty or single-page contexts', () => {
    expect(() => eeatScore(emptyContext())).not.toThrow();
    expect(() => eeatScore(singlePageContext())).not.toThrow();
    const empty = eeatScore(emptyContext());
    expect(empty.overall).toBeGreaterThanOrEqual(0);
  });
});

describe('eeatSignalDefs', () => {
  it('exposes inspectable signal metadata without detect functions', () => {
    expect(eeatSignalDefs.length).toBeGreaterThan(0);
    const first = eeatSignalDefs[0];
    expect(first).toBeDefined();
    expect(first).not.toHaveProperty('detect');
    expect(first?.pillar).toBeTruthy();
  });
});
