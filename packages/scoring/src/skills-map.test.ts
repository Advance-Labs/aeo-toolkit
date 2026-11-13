/**
 * Every rule the engine can fail must have exactly one skill that teaches an agent how to fix it.
 * `skills/rule-map.json` is that mapping; this test keeps it honest in both directions, so adding a
 * rule without a skill (or renaming a skill directory) fails CI instead of leaving a dead end.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { technicalSeoRules } from './technical-seo-rules.js';
import { aeoRules } from './aeo-rules.js';
import { eeatSignalDefs } from './eeat-rules.js';

const SKILLS_DIR = fileURLToPath(new URL('../../../skills/', import.meta.url));
const { rules: ruleMap } = JSON.parse(readFileSync(`${SKILLS_DIR}rule-map.json`, 'utf8')) as {
  rules: Record<string, string>;
};
const ruleIds = [...technicalSeoRules, ...aeoRules, ...eeatSignalDefs].map((r) => r.id);

describe('skills/rule-map.json', () => {
  it('maps every rule id', () => {
    expect(ruleIds.filter((id) => !(id in ruleMap))).toEqual([]);
  });

  it('maps no rule id that does not exist', () => {
    expect(Object.keys(ruleMap).filter((id) => !ruleIds.includes(id))).toEqual([]);
  });

  it('points every rule at a skill that exists', () => {
    const missing = [...new Set(Object.values(ruleMap))].filter(
      (skill) => !existsSync(`${SKILLS_DIR}${skill}/SKILL.md`),
    );
    expect(missing).toEqual([]);
  });

  // The router skill ships its own copy so it works when copied alone; it must not drift.
  it('is mirrored exactly in the aeo router skill', () => {
    const table = readFileSync(`${SKILLS_DIR}aeo/references/rules.md`, 'utf8');
    const rows = [...table.matchAll(/^\| `([^`]+)` \| \[`([^`]+)`\]/gm)].map(([, id, skill]) => [id, skill]);
    expect(Object.fromEntries(rows)).toEqual(ruleMap);
  });
});
