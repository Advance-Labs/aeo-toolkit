import { defineConfig } from 'tsup';

/**
 * Two entrypoints share one tool registry:
 *  - `server.ts` — stdio transport for local clients (Claude Desktop, Cursor).
 *  - `http.ts`   — HTTP/SSE transport for hosted/remote (Vercel) deployments.
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
