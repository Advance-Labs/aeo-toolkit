import { defineConfig } from 'tsup';

/**
 * Two entrypoints share one tool registry:
 *  - `server.ts` — stdio transport for local clients (Claude Desktop, Cursor).
 *  - `http.ts`   — Streamable-HTTP entry for hosted/remote (Vercel) deployments,
 *    plus the `.well-known` OAuth discovery handlers.
 * `dts` is disabled: this is an app, not a consumed library.
 */
export default defineConfig({
  entry: ['src/server.ts', 'src/http.ts'],
  format: ['esm'],
  sourcemap: true,
  clean: true,
  dts: false,
  treeshake: true,
});
