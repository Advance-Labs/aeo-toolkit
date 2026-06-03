/** @type {import('next').NextConfig} */
export default {
  transpilePackages: ['@aeo/crawler', '@aeo/html-parser', '@aeo/ui', '@aeo/types'],
  reactStrictMode: true,
  // Lint runs as its own Turbo task (`pnpm lint`); don't duplicate it during the build.
  eslint: { ignoreDuringBuilds: true },
};
