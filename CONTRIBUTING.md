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

- Shared types live in `@aeo/types` — never duplicate a type that belongs there.
- Cross-package imports use the package name (`@aeo/crawler`), never relative paths across packages.
- Libraries export **named** symbols only; no default exports.
- Keep network/filesystem I/O behind small adapters so logic stays unit-testable.
- See [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) for the full package template and code style.

## Adding a package

1. Create `packages/<name>/` following the template in `docs/CONVENTIONS.md`.
2. Name it `@aeo/<name>`; the `packages/*` workspace glob picks it up automatically.
3. Add `README.md`, tests, and a `CHANGELOG.md` stub.

## Security

Never commit secrets. `.env*`, `*.pem`, `*.key`, and `service-account*.json` are gitignored.
Report vulnerabilities privately to the maintainers rather than opening a public issue.
