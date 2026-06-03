import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  // NOTE: treeshake is intentionally OFF. Rollup's tree-shaker treats the bare "use client" banner
  // statement as dead code and removes it. With it off, the directive below survives the build.
  treeshake: false,
  // The design system is bundled into one module; some components use React hooks. Bundlers strip
  // per-file "use client" directives, so re-assert it for the whole bundle. This makes @aeo/ui a
  // client module — Server Components can still import it across the normal server→client boundary.
  banner: { js: "'use client';" },
});
