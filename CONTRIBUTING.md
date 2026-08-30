# Contributing

## Setup

```bash
corepack enable
pnpm install
pnpm build
```

Requires Node ≥ 20 (see `.nvmrc`) and pnpm ≥ 9.

## Workflow

1. Branch from `main`.
2. Make changes scoped to a single package/app where possible.
3. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` must pass.
4. Add a changeset: `pnpm changeset` (describe the change + bump level).
5. Open a PR. CI runs lint, typecheck, test, and build.

## Monorepo rules

- Shared types live in `@advance-labs/types` — never duplicate a type that belongs there.
- Cross-package imports use the package name (`@advance-labs/crawler`), never relative paths across packages.
- Libraries export **named** symbols only; no default exports.
- Keep network/filesystem I/O behind small adapters so logic stays unit-testable.
- See [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) for the full package template and code style.

## Adding a scoring rule

This is the best first contribution to the repo: it is self-contained, unit-testable, and
the rule set is never finished. A rule lives in one of three arrays in `@advance-labs/scoring`:

| File | Array | What belongs there |
|---|---|---|
| `packages/scoring/src/technical-seo-rules.ts` | `technicalSeoRules` | Crawlability, indexing, metadata, sitemaps |
| `packages/scoring/src/aeo-rules.ts` | `aeoRules` | Whether an answer engine can extract and cite the page |
| `packages/scoring/src/eeat-rules.ts` | `eeatSignalDefs` | Experience, expertise, authority, trust signals |

A rule is a plain object. Nothing is registered anywhere else:

```ts
{
  id: 'tech.charset-declared',        // '<family>.<kebab-name>', must be unique
  category: 'technical',
  severity: 'low',                    // 'low' | 'medium' | 'high'
  weight: 2,                          // relative contribution to the category score
  title: 'Character encoding is declared',
  description: 'Why this matters, one sentence.',
  recommendation: 'What the site owner should actually do.',
  docsUrl: 'https://...',             // optional, prefer a primary source
  evaluate: (ctx) => passed
    ? { passed: true }
    : { passed: false, detail: 'What was missing, specifically.' },
}
```

Rules for rules:

- `evaluate` must be **pure and defensive**. It receives a `ScoringContext` assembled from a
  real crawl; assume any field can be absent and never throw. Helpers in `context-utils.ts`
  (`meanOverPages`, `firstStructured`, `anyStructured`, `normalizeUrl`) exist for this.
- `detail` is shown to the user verbatim. Say what is missing, not that something failed.
- Do not flag correct markup. `aeo.entity-identity-consistent` is worth reading first: it
  deliberately does not flag third-party `Organization` nodes, because a case study naming
  another company is correct markup, not an error.

**One gotcha that will fail CI.** `packages/scoring/src/rules.test.ts` pins the exact count of
each rule family, because those totals are published on advancelabs.dev and had drifted into
being wrong. Adding a rule means updating that count in the same PR. The test comment lists
every marketing page that quotes the number. This is intentional friction: it is what stops
the public claim and the code from disagreeing again.

Then: add a test in the matching `*-rules.test.ts` exercising both branches against the
fixtures in `fixtures.ts` (`goodContext`, `poorContext`, `emptyContext`, `singlePageContext`),
and run `pnpm test --filter=@advance-labs/scoring`.

## Adding a package

1. Create `packages/<name>/` following the template in `docs/CONVENTIONS.md`.
2. Name it `@advance-labs/<name>`; the `packages/*` workspace glob picks it up automatically.
3. Add `README.md`, tests, and a `CHANGELOG.md` stub.

## Security

Never commit secrets. `.env*`, `*.pem`, `*.key`, and `service-account*.json` are gitignored.
Report vulnerabilities privately to the maintainers rather than opening a public issue.
