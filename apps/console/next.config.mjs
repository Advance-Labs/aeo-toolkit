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
  // `@react-pdf/renderer` (used by `@aeo/pdf` in the /api/audit/technical/pdf route) must not be
  // webpack-bundled: bundling mangles its internal font/layout machinery and the renderer throws
  // "Cannot read properties of undefined (reading 'S')" at runtime. Keep it external so Next
  // require()s it from node_modules in the server function instead.
  serverExternalPackages: ['@react-pdf/renderer'],
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
  webpack: (config, { isServer }) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };
    // Belt-and-suspenders for the PDF renderer: `serverExternalPackages` alone does not externalize
    // `@react-pdf/renderer` here (it's reached through a workspace symlink), so it ends up bundled
    // and breaks. Force it (and its subpackages) external on the server build so they load from
    // node_modules at runtime — the same way the renderer works under plain Node.
    if (isServer) {
      const externals = Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean);
      externals.unshift(({ request }, callback) => {
        if (request && /^@react-pdf\//.test(request)) {
          return callback(null, `commonjs ${request}`);
        }
        return callback();
      });
      config.externals = externals;
    }
    return config;
  },
};
