import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,

  // `standalone` emits a self-contained server bundle with only the traced runtime deps,
  // which is what makes a sane Docker image possible (no pnpm store, no workspace symlinks
  // to resolve at runtime). Opt-in via env so the Vercel build path is untouched.
  ...(process.env.BUILD_STANDALONE === '1' ? { output: 'standalone' } : {}),
  // These pages are also served from advancelabs.dev/tools/* via a rewrite in the marketing
  // app. Without an absolute assetPrefix, the proxied HTML would request /_next/static/* from
  // advancelabs.dev, where that path belongs to a DIFFERENT Next build — every chunk 404s (or,
  // worse, silently resolves to a mismatched bundle). Pointing it at this origin makes assets
  // load straight from here regardless of which domain rendered the page.
  //
  // Only applied in production: `next dev` serves assets from localhost.
  // Overridable so a SELF-HOSTED instance serves its own assets. Without this, a
  // self-hoster's container would fetch every chunk from aeo.advancelabs.dev — someone
  // else's origin, which is both a hard dependency and a privacy problem. Set
  // `NEXT_PUBLIC_ASSET_PREFIX=` (empty) to serve from the instance's own origin; the
  // Docker image does exactly that. Unset keeps the hosted deployment's behaviour.
  assetPrefix:
    process.env.NEXT_PUBLIC_ASSET_PREFIX !== undefined
      ? process.env.NEXT_PUBLIC_ASSET_PREFIX || undefined
      : process.env.NODE_ENV === 'production'
        ? 'https://aeo.advancelabs.dev'
        : undefined,

  async headers() {
    return [
      {
        // Cross-origin <script>/<link> loads don't need CORS, but font files fetched from CSS
        // DO — next/font self-hosts under /_next/static/media, so without this the proxied
        // pages render in fallback fonts.
        source: '/_next/static/:path*',
        headers: [{ key: 'Access-Control-Allow-Origin', value: 'https://advancelabs.dev' }],
      },
    ];
  },
  // Lint runs as its own Turbo task (`pnpm lint`); don't duplicate it during the build.
  eslint: { ignoreDuringBuilds: true },
  // We're an app inside a pnpm workspace. Point output file tracing at the monorepo root so Next's
  // tracer (nft) can follow workspace symlinks (e.g. `@advance-labs/pdf` → `@react-pdf/renderer` in the
  // shared `.pnpm` store) when collecting the files each serverless function needs. Without this,
  // the tracing root defaults to the app dir and react-pdf is silently dropped from the Lambda →
  // "Cannot find module '@react-pdf/renderer'" at runtime on the PDF route.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // The PDF route depends on `@advance-labs/pdf`, which is ESM-only and wraps the (also ESM-only)
  // `@react-pdf/renderer`. Keep BOTH external so webpack never bundles them: bundling react-pdf
  // mangles its font/layout internals ("reading 'S'"), and bundling @advance-labs/pdf would collapse its
  // internal `import '@react-pdf/renderer'` into a CJS `require()` of an ESM module → ERR_REQUIRE_ESM
  // on the Vercel function runtime. External + a dynamic `import()` in the route (see route.ts) keeps
  // the whole chain on Node's ESM loader. They resolve from the app's own node_modules because
  // @react-pdf/renderer is a direct dependency and @advance-labs/pdf is a workspace dependency.
  serverExternalPackages: ['@advance-labs/pdf', '@react-pdf/renderer'],
  transpilePackages: [
    '@advance-labs/backlinks',
    '@advance-labs/blogging',
    '@advance-labs/crawler',
    '@advance-labs/google-api',
    '@advance-labs/html-parser',
    '@advance-labs/llm',
    '@advance-labs/mcp-core',
    // NOTE: '@advance-labs/pdf' is intentionally NOT transpiled. It ships compiled dist and pulls in
    // '@react-pdf/renderer'; listing it here would bundle react-pdf's subtree (mangling its
    // font/layout internals → "reading 'S'" at runtime) and override serverExternalPackages above.
    '@advance-labs/schema-validator',
    '@advance-labs/scoring',
    '@advance-labs/storage',
    '@advance-labs/types',
    '@advance-labs/ui',
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
    // route loads @advance-labs/pdf via dynamic `import()` so the ESM chain stays on Node's ESM loader.
    return config;
  },
};
