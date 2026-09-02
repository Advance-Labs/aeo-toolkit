/**
 * Pins the published MCP connection URLs to the routes that actually serve them.
 *
 * These two things drifted apart once already and every published connection string was
 * dead for the life of the feature. `mcp-handler` derives its transport endpoints from
 * `basePath` as `${basePath}/mcp` and answers only there; mounted at the basePath itself
 * it returns its own plain-text "Not found", which reads like a platform routing fault.
 *
 * Nothing in the type system connects the catalog's URL strings to the filesystem routes,
 * so this test is the connection. Flattening a `[transport]` directory back to a plain
 * `route.ts` looks like a harmless cleanup and silently kills every server.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MCP_SERVERS } from './mcp-catalog.js';

const API_MCP_DIR = join(process.cwd(), 'src/app/api/mcp');

describe('MCP catalog endpoints', () => {
  it('lists every server exactly once', () => {
    const slugs = MCP_SERVERS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs.length).toBeGreaterThan(0);
  });

  it.each(MCP_SERVERS.map((s) => [s.slug, s.endpoint] as const))(
    '%s advertises the transport path, not the bare mount path',
    (slug, endpoint) => {
      // The trailing segment is what mcp-handler matches on. Without it the URL is dead.
      expect(endpoint).toMatch(/\/api\/mcp\/[a-z0-9-]+\/mcp$/);
      expect(endpoint).toContain(`/api/mcp/${slug}/mcp`);
    },
  );

  it.each(MCP_SERVERS.map((s) => s.slug))(
    '%s has a [transport] route on disk backing that URL',
    (slug) => {
      const transportRoute = join(API_MCP_DIR, slug, '[transport]', 'route.ts');
      const flatRoute = join(API_MCP_DIR, slug, 'route.ts');

      expect(
        existsSync(transportRoute),
        `expected ${slug}/[transport]/route.ts — the dynamic segment is what makes ` +
          'the /mcp transport path resolvable',
      ).toBe(true);

      // A flat route alongside it would shadow nothing but signals someone is mid-revert.
      expect(
        existsSync(flatRoute),
        `${slug}/route.ts should not exist; mcp-handler does not answer at the bare mount path`,
      ).toBe(false);
    },
  );

  it('every advertised endpoint is absolute', () => {
    // A relative URL silently breaks every MCP client, which cannot resolve it.
    for (const server of MCP_SERVERS) {
      expect(() => new URL(server.endpoint)).not.toThrow();
      expect(server.endpoint.startsWith('http')).toBe(true);
    }
  });
});

/**
 * The catalog is hand-authored from the server registrations, so nothing stops the two from
 * diverging. They already did: `gsc_traffic_drop`, `gsc_cannibalization`, and `gsc_decay` were
 * registered on the ga-gsc server and live in production, but were missing from the catalog —
 * so the public /mcp page under-advertised three tools, including the three the shipped Claude
 * Skills are built on.
 *
 * Read the names out of the server source rather than importing and running the server, which
 * would need a full runtime context. This mirrors `mcp/skills.test.ts`.
 *
 * Scan the whole server directory, not just `server.ts`: ga-gsc declares its tool names inline
 * in `server.ts`, but backlink declares each one in its own `tools/*.ts` file.
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

function registeredToolNames(slug: string): Set<string> {
  const names = new Set<string>();
  for (const file of sourceFiles(join(process.cwd(), 'src/mcp', slug))) {
    for (const match of readFileSync(file, 'utf8').matchAll(/name:\s*'([a-z0-9]+(?:_[a-z0-9]+)+)'/g)) {
      names.add(match[1] as string);
    }
  }
  return names;
}

describe('MCP catalog tools', () => {
  it.each(MCP_SERVERS.map((s) => s.slug))(
    '%s advertises no tool the server does not register',
    (slug) => {
      const registered = registeredToolNames(slug);
      const advertised = MCP_SERVERS.find((s) => s.slug === slug)!.tools.map((t) => t.name);
      const phantom = advertised.filter((name) => !registered.has(name));

      expect(
        phantom,
        `${slug}: the catalog advertises ${phantom.join(', ')}, which no longer exist on the ` +
          'server. A client that trusts the page will call a tool that is not there.',
      ).toEqual([]);
    },
  );

  // TODO(lucas): assert the other direction — a tool registered on the server but absent from
  // the catalog. That is the direction that actually bit us (three ga-gsc tools shipped
  // unadvertised for the life of the feature), and `registeredToolNames` above already does the
  // work. The open question is the policy, not the code:
  //
  //   strict parity  — adding a server tool fails CI until someone writes its public summary.
  //                    Closes this hole for good; costs a copywriting step per new tool.
  //   allowlist      — keep a documented set of deliberately-unadvertised tools. No friction,
  //                    but the guard is only as good as the allowlist's upkeep.
});
