/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  // Lint runs as its own Turbo task (`pnpm lint`); don't duplicate it during the build.
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: [
    '@aeo/crawler',
    '@aeo/html-parser',
    '@aeo/schema-validator',
    '@aeo/scoring',
    '@aeo/ui',
    '@aeo/types',
  ],
};
