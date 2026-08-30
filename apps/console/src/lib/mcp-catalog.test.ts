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
import { existsSync } from 'node:fs';
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
