---
title: Conventions
description: >-
  Package layout, code style, testing, and the seven security invariants binding on every contribution.
---

House style for every package and app in the monorepo. If you are adding a package, copy the shape of
an existing one — [`packages/net-guard`](../packages/net-guard) is a good small template,
[`packages/scoring`](../packages/scoring) a good large one.

## Package layout

```
packages/<name>/
├── package.json
├── tsconfig.json           # extends @advance-labs/config
├── tsup.config.ts          # libraries only
├── vitest.config.ts
├── README.md               # purpose, usage snippet, public API table, status
├── CHANGELOG.md
└── src/
    ├── index.ts            # public surface — re-export only what consumers need
    ├── <feature>.ts
    └── <feature>.test.ts
```

### `package.json`

```jsonc
{
  "name": "@advance-labs/<name>",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src",
    "test": "vitest run",
    "clean": "rimraf dist .turbo"
  },
  "dependencies": { "@advance-labs/types": "workspace:*" },
  "devDependencies": {
    "@advance-labs/config": "workspace:*",
    "tsup": "^8.3.5", "typescript": "^5.7.2", "vitest": "^2.1.8", "rimraf": "^6.0.1"
  }
}
```

Add `"private": true` unless the package is genuinely useful standalone. Ten of sixteen are internal —
that is the default, not the exception. Publishing is a support commitment.

### Config files

```jsonc
// tsconfig.json
{ "extends": "../config/tsconfig/node-library.json", "include": ["src"] }
```

```ts
// tsup.config.ts
import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/index.ts'], format: ['esm'], dts: true,
  sourcemap: true, clean: true, treeshake: true,
});
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['src/**/*.test.ts'] } });
```

## Apps

There are two, and adding a third needs a good reason — [ADR-0003](adr/0003-single-vercel-deployment.md)
consolidated nine apps into one on purpose.

- **`apps/console`** — Next.js App Router. New browser tools are a route under `src/app/tools/` plus a
  route handler under `src/app/api/`. Handlers are `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`
  POST endpoints returning JSON. New MCP servers are route handlers via the `mcp-handler` adapter.
- **`apps/chrome-extension`** — Vite + `@crxjs/vite-plugin`, MV3. Workspace deps are bundled; there is
  no Node at runtime, so use `jsPDF` rather than `@advance-labs/pdf`.

## Code style

- TypeScript strict. `verbatimModuleSyntax` is on → use `import type { X }` for type-only imports.
- ESM only. Named exports only in libraries — no default exports. Relative imports carry `.js`.
- No `any`. Use `unknown` and narrow. Honour `noUncheckedIndexedAccess` — indexed access may be
  `undefined`.
- **Inject all I/O.** Network, clock, and storage go through small injectable seams. No `Date.now()`
  or `Math.random()` in pure cores. This is why the suite tests with zero network.
- Throw typed `Error` subclasses. MCP tools return structured error objects — never a silent fallback.
- Comments explain *why*, not *what*, and match the density of the surrounding code.

## Testing

Vitest. **868 tests currently pass**; keep it that way.

- Unit-test pure logic against fixtures (sample HTML, sitemaps, API payloads).
- No live network in tests — mock the injected fetcher, and the Google and LLM clients.
- At least a happy path plus one edge case per exported function.

```bash
pnpm test                              # everything
pnpm test --filter=@advance-labs/scoring
```

## Security invariants

Binding on all code, not just the managed tier. CI and review check for these.

1. **SSRF-guarded fetch only.** Any fetch of a user-supplied or external URL goes through
   [`@advance-labs/net-guard`](../packages/net-guard)`.safeFetch`. Never call a raw HTTP seam on a
   user-controlled URL. The guard does scheme allowlisting, DNS resolution with rejection of
   private/loopback/link-local/CGNAT/metadata addresses (v4 and v6), redirect-hop revalidation, body
   and time caps, and host-pinning against DNS rebinding.
2. **Service-role writes sit behind ownership checks.** Service-role bypasses RLS, so application code
   must resolve session → load record → assert `record.ownerId === session.user.id` (or a staff role)
   → then act. RLS-on-SELECT is not an authorization control for service-role mutations.
3. **No plaintext tokens.** Construct `TokenStore` with `requireEncryption`; a missing `encryptionKey`
   throws. Tokens are keyed `(user_id, provider)`, never `user_id` alone.
4. **External text is data, not instructions.** Scraped or third-party content fed to an LLM is
   delimited and passed as structured data — never concatenated into a system prompt.
5. **Schema-validate every LLM output.** Parse each model response against a schema and reject on
   mismatch. Free-form model text is never control flow.
6. **`href` allowlist, sanitize before publish.** Any URL that reaches published or sent content must
   equal an already-agreed target, never a model-derived one. Escape on insertion; add `rel`
   disclosure where applicable.
7. **Dormant means closed, not open.** The free tools fail *open* to `free`. The managed tier does the
   opposite: it requires auth plus an active entitlement and returns closed when its env is absent.
   Gate the orchestrator enqueue and execute paths, not just the UI.

## Documentation

- Every package and app ships a `README.md`: one-paragraph purpose, a usage snippet, a public API
  table, and a status line saying what is wired versus stubbed.
- Mark stubbed integrations `// STUB:` with a TODO and a typed interface, so the wiring point is
  obvious.
- **Retire planning docs when they ship.** A design doc that describes work already delivered belongs
  in [`archive/`](archive/) with a banner, not in `docs/` where it reads as current. Most of the
  drift this repo has accumulated came from skipping this step.
