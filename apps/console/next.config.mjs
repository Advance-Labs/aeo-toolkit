/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  // Lint runs as its own Turbo task (`pnpm lint`); don't duplicate it during the build.
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: [
    '@aeo/backlinks',
    '@aeo/blogging',
    '@aeo/crawler',
    '@aeo/google-api',
    '@aeo/html-parser',
    '@aeo/llm',
    '@aeo/mcp-core',
    '@aeo/pdf',
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
    return config;
  },
};
