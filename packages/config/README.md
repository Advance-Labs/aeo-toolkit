# @advance-labs/config

Shared toolchain configuration for the AEO Toolkit monorepo: ESLint (flat), TypeScript presets, Prettier.

## Usage

**ESLint** — the root `eslint.config.js` imports from here; packages need no local config:

```js
import { baseConfig } from '@advance-labs/config/eslint';      // node libraries
import { reactConfig } from '@advance-labs/config/eslint/react'; // React / UI
```

**TypeScript** — extend a preset in a package `tsconfig.json`:

```jsonc
{ "extends": "../config/tsconfig/node-library", "include": ["src"] }
```

Presets: `tsconfig/base`, `tsconfig/node-library`, `tsconfig/react-library`, `tsconfig/next`.

**Prettier** — `.prettierrc.json` at the repo root mirrors `prettier/index.json`.

## Status

✅ Implemented.
