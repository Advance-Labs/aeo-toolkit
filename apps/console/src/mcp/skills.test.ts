/**
 * Validates the Claude Skills in `/skills` against the MCP tools they drive.
 *
 * A skill is markdown, so nothing about it is type-checked: a renamed tool, a typo in
 * a tool name, or a missing frontmatter field all fail silently at runtime, in front
 * of a user, with no error. These tests are the gate that catches that at CI time.
 *
 * The important assertion is the last one: every `gsc_*` / `ga4_*` tool a skill tells
 * the model to call must actually be registered in `server.ts`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Repo root, from `apps/console`. */
const SKILLS_DIR = join(process.cwd(), '..', '..', 'skills');

/** Tool names as registered in `ga-gsc/server.ts`, read from source so it cannot drift. */
function registeredToolNames(): Set<string> {
  const server = readFileSync(join(process.cwd(), 'src/mcp/ga-gsc/server.ts'), 'utf8');
  return new Set([...server.matchAll(/name:\s*'([a-z0-9_]+)'/g)].map((m) => m[1] as string));
}

function skillDirs(): string[] {
  return readdirSync(SKILLS_DIR).filter((entry) =>
    statSync(join(SKILLS_DIR, entry)).isDirectory(),
  );
}

/** Split `---`-delimited YAML frontmatter from a skill body. */
function parseSkill(dir: string): { frontmatter: Record<string, string>; body: string } {
  // Normalized to LF first: a Windows clone with core.autocrlf=true checks the file out
  // with CRLF endings, which would otherwise fail the frontmatter regex and the line
  // splits below even though the skill itself is fine.
  const raw = readFileSync(join(SKILLS_DIR, dir, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  if (match === null) throw new Error(`${dir}/SKILL.md has no frontmatter block`);

  const frontmatter: Record<string, string> = {};
  for (const line of (match[1] ?? '').split('\n')) {
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    frontmatter[line.slice(0, sep).trim()] = line.slice(sep + 1).trim();
  }
  return { frontmatter, body: match[2] ?? '' };
}

describe('skills', () => {
  const dirs = skillDirs();

  it('ships at least one skill', () => {
    expect(dirs.length).toBeGreaterThan(0);
  });

  it.each(dirs)('%s has a name matching its directory', (dir) => {
    // The directory name is what a user copies; a mismatch makes the skill hard to find.
    expect(parseSkill(dir).frontmatter.name).toBe(dir);
  });

  it.each(dirs)('%s has a description that says when to use it', (dir) => {
    const description = parseSkill(dir).frontmatter.description ?? '';
    // The description is the ONLY thing deciding whether a skill activates, so a bare
    // title ("Traffic drop analysis") means it effectively never triggers.
    expect(description.length).toBeGreaterThan(80);
    expect(description.toLowerCase()).toContain('use when');
  });

  it.each(dirs)('%s only references tools that are actually registered', (dir) => {
    const registered = registeredToolNames();
    const { body } = parseSkill(dir);
    const mentioned = new Set(
      [...body.matchAll(/`((?:gsc|ga4|list)_[a-z0-9_]+)`/g)].map((m) => m[1] as string),
    );
    expect(mentioned.size).toBeGreaterThan(0); // a skill that calls nothing is a doc, not a skill
    for (const tool of mentioned) {
      expect(registered, `${dir} references unregistered tool "${tool}"`).toContain(tool);
    }
  });

  it('registeredToolNames actually finds the tools (guards the regex itself)', () => {
    // If the parse silently returned an empty set, the assertion above would pass vacuously.
    expect(registeredToolNames()).toContain('gsc_traffic_drop');
  });
});
