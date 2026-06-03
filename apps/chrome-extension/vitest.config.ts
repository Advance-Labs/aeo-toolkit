import { defineConfig } from 'vitest/config';

// Standalone test config — deliberately does NOT load the @crxjs plugin (which
// expects an extension build context). Tests cover the pure pipeline logic
// (robots/sitemap parsing, single-page context assembly, audit aggregation).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
