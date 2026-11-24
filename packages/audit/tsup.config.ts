import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  sourcemap: true,
  clean: true,
  banner: { js: '#!/usr/bin/env node' },
});
