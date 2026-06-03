# Conventions

Every package and app in this monorepo follows these rules. Agents building a package **must**
adhere to this document exactly so the 20 independently-authored units integrate cleanly.

## Golden rules for parallel builds

1. **Stay in your lane.** Only create/edit files inside your assigned directory
   (`packages/<name>/` or `apps/<name>/`). Never edit root files, another package, or `pnpm-lock.yaml`.
2. **Never run `pnpm install`, `pnpm build`, or `turbo`.** Dependencies are not installed during your run;
   the lead runs one central install/build pass afterward. Write code as if deps exist.
3. **Depend only on packages listed in your brief.** Reference shared types from `@aeo/types`, never redefine them.
4. **Write tests and a README.** Every package ships `*.test.ts` (Vitest) and a `README.md`.

## Package layout (libraries under `packages/`)

```
packages/<name>/
├── package.json
├── tsconfig.json
├── tsup.config.ts          # build config (libraries only)
├── vitest.config.ts
├── README.md
├── CHANGELOG.md            # "# @aeo/<name>\n\nInitial release." stub
└── src/
    ├── index.ts            # public surface — re-export only what consumers need
    ├── <feature>.ts
    └── <feature>.test.ts
```

### Library `package.json` template

```jsonc
{
  "name": "@aeo/<name>",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src",
    "test": "vitest run",
    "clean": "rimraf dist .turbo"
  },
  "dependencies": {
    "@aeo/types": "workspace:*"
  },
  "devDependencies": {
    "@aeo/config": "workspace:*",
    "tsup": "^8.3.5",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8",
    "rimraf": "^6.0.1"
  }
}
```

### `tsconfig.json` (library)

```jsonc
{ "extends": "../config/tsconfig/node-library.json", "include": ["src"] }
```

### `tsup.config.ts`

```ts
import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
});
```

### `vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['src/**/*.test.ts'] } });
```

## App layout (under `apps/`)

- **Next.js apps** (`llm-audit`, `eeat-scanner`, `llms-txt-generator`, `ga-gsc-chat`): App Router,
  `src/app/`, route handlers under `src/app/api/.../route.ts`, server-only crawl logic, `next.config.mjs`
  with `transpilePackages` for the `@aeo/*` deps. Scripts: `dev`, `build`, `start`, `lint`, `typecheck`.
- **MCP servers** (`ai-visibility-mcp`, `ga-gsc-mcp`, `backlink-mcp`): Node entry `src/server.ts`,
  tool definitions under `src/tools/`, build with `tsup`. Provide both a local run script and a
  Vercel function entry where the spec requires hosted/remote operation.
- **Chrome extension** (`chrome-extension`): Vite + `@crxjs/vite-plugin`, MV3 `manifest.config.ts`,
  `src/background/`, `src/content/`, `src/popup/`. Build to `dist/`.
- **Blogging agent** (`blogging-agent`): Node TS pipeline in `src/agents/*`, orchestrator in
  `src/run.ts`, GitHub Actions workflow under the app's own `.github/` doc + a root workflow reference.

## Code style

- TypeScript strict (inherited). `verbatimModuleSyntax` is on → use `import type { X }` for type-only imports.
- Named exports only (no default exports in libraries). ESM only.
- No `any` — use `unknown` + narrowing. Honor `noUncheckedIndexedAccess` (array access may be `undefined`).
- Pure functions where possible; isolate I/O (network/fs) behind small adapters for testability.
- Errors: throw typed `Error` subclasses; MCP tools return structured error objects, never silent fallbacks.
- Comments explain *why*, not *what*. Match the density of surrounding code.

## Testing

- Vitest. Unit-test pure logic with fixtures (sample HTML, sample sitemaps, sample API payloads).
- No live network in tests — mock `undici`/fetch and Google/LLM clients.
- Each package: at least the happy path + one edge case per exported function.

## Documentation

- Every package/app `README.md`: one-paragraph purpose, install/usage snippet, public API table,
  and a "Status" line (implemented vs stubbed) so consumers know what is wired vs placeholder.
- Stubbed integrations (live OAuth, paid APIs) are clearly marked `// STUB:` with a TODO and a typed
  interface so the wiring point is obvious.
