import { describe, expect, it } from 'vitest';
import { ruleGuideUrl } from './guide-url.js';
import { runRules } from './engine.js';
import { technicalSeoRules } from './technical-seo-rules.js';
import { aeoRules } from './aeo-rules.js';
import { eeatSignalDefs } from './eeat-rules.js';
import { poorContext } from './fixtures.js';

describe('ruleGuideUrl', () => {
  it('gives every rule a guide on the docs rules page for its family', () => {
    for (const { id } of [...technicalSeoRules, ...aeoRules, ...eeatSignalDefs]) {
      expect(ruleGuideUrl(id)).toMatch(
        new RegExp(`^https://docs\\.advancelabs\\.dev/aeo-toolkit/rules/(technical-seo|aeo|eeat)/#${id.replace(/\./g, '\\.')}$`),
      );
    }
  });

  it('returns undefined for an unknown family', () => {
    expect(ruleGuideUrl('custom.thing')).toBeUndefined();
  });

  it('is set on every finding the engine produces', async () => {
    const result = await runRules(poorContext(), [...technicalSeoRules, ...aeoRules]);
    const findings = result.categories.flatMap((c) => c.findings);
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) expect(f.guideUrl).toBe(ruleGuideUrl(f.id));
  });
});
