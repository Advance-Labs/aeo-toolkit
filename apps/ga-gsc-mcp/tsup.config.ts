import { defineConfig } from 'tsup';

// App build (not a library): emit runnable JS for both entrypoints, no .d.ts.
//  - src/server.ts → stdio transport for Claude Desktop / local dev
//  - src/http.ts   → Node HTTP/SSE entry for hosted/Vercel + .well-known OAuth discovery
export default defineConfig({
  entry: ['src/server.ts', 'src/http.ts'],
  format: ['esm'],
  sourcemap: true,
  clean: true,
  dts: false,
  treeshake: true,
});
