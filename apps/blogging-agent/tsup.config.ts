import { defineConfig } from 'tsup';

// App build (not a library): emit a runnable orchestrator entry, no .d.ts.
//  - src/run.ts → the pipeline orchestrator invoked by GitHub Actions or `node dist/run.js`.
export default defineConfig({
  entry: ['src/run.ts'],
  format: ['esm'],
  sourcemap: true,
  clean: true,
  dts: false,
  treeshake: true,
});
