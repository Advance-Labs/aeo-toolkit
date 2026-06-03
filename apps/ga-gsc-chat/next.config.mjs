/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@aeo/google-api', '@aeo/llm', '@aeo/ui', '@aeo/types'],
  reactStrictMode: true,
  // Lint runs as its own Turbo task (`pnpm lint`); don't duplicate it during the build.
  eslint: { ignoreDuringBuilds: true },
  // Resolve ESM-style ".js" specifiers to their ".ts"/".tsx" sources (our code imports with .js
  // extensions per verbatimModuleSyntax). Without this webpack can't find the local lib modules.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };
    return config;
  },
};

export default nextConfig;
