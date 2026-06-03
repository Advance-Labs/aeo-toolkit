import { baseConfig } from '@aeo/config/eslint';

/**
 * Root flat config. ESLint walks up from each package to find this file, so individual
 * packages do not need their own config. React/UI packages add their own eslint.config.js
 * that re-exports `@aeo/config/eslint/react`.
 */
export default [
  ...baseConfig,
  {
    ignores: ['**/dist/**', '**/.next/**', '**/build/**', '**/coverage/**', '**/.turbo/**'],
  },
];
