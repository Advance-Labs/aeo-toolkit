/**
 * Behavioural evals for the agent skills in /skills.
 *
 * Each `evals/skills/<skill>/` holds a small broken site (`site/`) and an `eval.json` with the prompt
 * a user would type and the rule ids that must pass afterwards. Scoring uses the same client-side
 * single-page audit as the Chrome extension, so no network and no hosted platform are involved.
 *
 * Two layers:
 *   - ALWAYS: every fixture really fails its target rules today. Without this, an eval whose
 *     fixture accidentally passes would "succeed" without the agent doing anything.
 *   - OPT-IN (SKILL_EVALS=1): copy the site and ONLY the skill under test into a temp dir, run a
 *     headless `claude -p` there with file tools only, re-score, and require the targets to pass
 *     with no rule that passed before now failing. This spends model tokens, so CI never runs it.
 *     SKILL_EVALS_ONLY=<skill>[,<skill>] narrows the run; SKILL_EVALS_MODEL picks the model.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runAudit } from './audit.js';
import type { FetchedFile } from './site-files.js';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const EVALS = join(REPO, 'evals/skills');
const SKILLS = join(REPO, 'skills');
const RUN = process.env.SKILL_EVALS === '1';
const ONLY = process.env.SKILL_EVALS_ONLY?.split(',').filter(Boolean);
const MODEL = process.env.SKILL_EVALS_MODEL ?? 'sonnet';

interface EvalSpec {
  pageUrl: string;
  prompt: string;
  expectPass: string[];
}

function file(dir: string, name: string): FetchedFile {
  const p = join(dir, name);
  return existsSync(p) ? { body: readFileSync(p, 'utf8'), exists: true } : { body: null, exists: false };
}

/** Rule id -> passed, for the single-page audit of `<siteDir>/index.html` served at `pageUrl`. */
async function score(siteDir: string, pageUrl: string): Promise<Map<string, boolean>> {
  const payload = await runAudit({
    pageUrl,
    html: readFileSync(join(siteDir, 'index.html'), 'utf8'),
    startedAtMs: Date.now(),
    siteFiles: {
      robotsTxt: file(siteDir, 'robots.txt'),
      sitemapXml: file(siteDir, 'sitemap.xml'),
      llmsTxt: file(siteDir, 'llms.txt'),
      llmsFullTxt: file(siteDir, 'llms-full.txt'),
      favicon: file(siteDir, 'favicon.ico'),
    },
  });
  return new Map(
    payload.report.score.categories.flatMap((c) => c.findings.map((f) => [f.id, f.passed] as const)),
  );
}

const evals = existsSync(EVALS)
  ? readdirSync(EVALS).filter((d) => existsSync(join(EVALS, d, 'eval.json')))
  : [];

describe('skill eval fixtures', () => {
  it('exist, and each targets a real skill', () => {
    expect(evals.length).toBeGreaterThan(0);
    for (const skill of evals) expect(existsSync(join(SKILLS, skill, 'SKILL.md')), skill).toBe(true);
  });

  it.each(evals)('%s fixture fails every rule it expects the skill to fix', async (skill) => {
    const spec = JSON.parse(readFileSync(join(EVALS, skill, 'eval.json'), 'utf8')) as EvalSpec;
    const before = await score(join(EVALS, skill, 'site'), spec.pageUrl);
    for (const id of spec.expectPass) {
      expect(before.has(id), `${skill}: rule ${id} is not evaluated on this fixture`).toBe(true);
      expect(before.get(id), `${skill}: rule ${id} already passes before the agent runs`).toBe(false);
    }
  });
});

describe.skipIf(!RUN)('skill evals (agent runs; SKILL_EVALS=1)', () => {
  const selected = ONLY ? evals.filter((e) => ONLY.includes(e)) : evals;

  it.each(selected)(
    '%s: an agent with only this skill fixes the target rules without regressions',
    async (skill) => {
      const spec = JSON.parse(readFileSync(join(EVALS, skill, 'eval.json'), 'utf8')) as EvalSpec;
      const work = mkdtempSync(join(tmpdir(), `skill-eval-${skill}-`));
      try {
        cpSync(join(EVALS, skill, 'site'), work, { recursive: true });
        cpSync(join(SKILLS, skill), join(work, '.claude/skills', skill), { recursive: true });
        const before = await score(work, spec.pageUrl);

        execFileSync(
          'claude',
          [
            '-p',
            spec.prompt,
            '--model',
            MODEL,
            '--permission-mode',
            'acceptEdits',
            '--allowedTools',
            'Read,Edit,Write,Glob,Grep,Skill',
            '--strict-mcp-config',
            // Drop the runner's user-level hooks, plugins and MCP servers. (--bare would isolate
            // fully but only authenticates with ANTHROPIC_API_KEY; user CLAUDE.md and user skills
            // can still load here, so run evals from a machine without unrelated AEO skills.)
            '--setting-sources',
            'project,local',
          ],
          { cwd: work, stdio: ['ignore', 'pipe', 'pipe'], timeout: 15 * 60_000, maxBuffer: 32 * 1024 * 1024 },
        );

        const after = await score(work, spec.pageUrl);
        for (const id of spec.expectPass) expect(after.get(id), `${skill}: ${id} still fails`).toBe(true);
        const regressed = [...before].filter(([id, passed]) => passed && after.get(id) === false);
        expect(regressed.map(([id]) => id), `${skill}: rules that regressed`).toEqual([]);
      } finally {
        rmSync(work, { recursive: true, force: true });
      }
    },
    16 * 60_000,
  );
});
