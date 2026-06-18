import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  // Lint runs as its own Turbo task (`pnpm lint`); don't duplicate it during the build.
  eslint: { ignoreDuringBuilds: true },
  // We're an app inside a pnpm workspace. Point output file tracing at the monorepo root so Next's
  // tracer (nft) can follow workspace symlinks (e.g. `@aeo/pdf` → `@react-pdf/renderer` in the
  // shared `.pnpm` store) when collecting the files each serverless function needs. Without this,
  // the tracing root defaults to the app dir and react-pdf is silently dropped from the Lambda →
  // "Cannot find module '@react-pdf/renderer'" at runtime on the PDF route.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // The PDF route depends on `@aeo/pdf`, which is ESM-only and wraps the (also ESM-only)
  // `@react-pdf/renderer`. Keep BOTH external so webpack never bundles them: bundling react-pdf
  // mangles its font/layout internals ("reading 'S'"), and bundling @aeo/pdf would collapse its
  // internal `import '@react-pdf/renderer'` into a CJS `require()` of an ESM module → ERR_REQUIRE_ESM
  // on the Vercel function runtime. External + a dynamic `import()` in the route (see route.ts) keeps
  // the whole chain on Node's ESM loader. They resolve from the app's own node_modules because
  // @react-pdf/renderer is a direct dependency and @aeo/pdf is a workspace dependency.
  serverExternalPackages: ['@aeo/pdf', '@react-pdf/renderer'],
  transpilePackages: [
    '@aeo/backlinks',
    '@aeo/blogging',
    '@aeo/crawler',
    '@aeo/google-api',
    '@aeo/html-parser',
    '@aeo/llm',
    '@aeo/mcp-core',
    // NOTE: '@aeo/pdf' is intentionally NOT transpiled. It ships compiled dist and pulls in
    // '@react-pdf/renderer'; listing it here would bundle react-pdf's subtree (mangling its
    // font/layout internals → "reading 'S'" at runtime) and override serverExternalPackages above.
    '@aeo/schema-validator',
    '@aeo/scoring',
    '@aeo/storage',
    '@aeo/types',
    '@aeo/ui',
  ],
  // Resolve ESM-style ".js" specifiers to their ".ts"/".tsx" sources (verbatimModuleSyntax).
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };
    // NOTE: no manual `commonjs @react-pdf/*` external here. An earlier version added one, but
    // emitting an ESM-only package as a `commonjs` external makes the CJS server bundle `require()`
    // it → ERR_REQUIRE_ESM at runtime. `serverExternalPackages` above handles externalization; the
    // route loads @aeo/pdf via dynamic `import()` so the ESM chain stays on Node's ESM loader.
    return config;
  },
};
