# Security Policy

## Reporting

Report vulnerabilities privately to the Advance Labs maintainers rather than opening a public issue.

## Baseline guarantees

- **No secrets in git.** `.gitignore` blocks `.env*`, `*.pem`, `*.key`, `service-account*.json`,
  `credentials*.json`. CI does not echo secrets.
- **BYOK keys are request-scoped.** Users' LLM / Perplexity / OpenAI keys are never persisted or logged;
  they are read from the request and discarded.
- **OAuth tokens are encrypted at rest** via a pluggable `TokenStore` interface (the production Supabase
  adapter encrypts refresh tokens; the default in-memory store is for local/dev only).
- **MCP servers enforce rate limiting** (token bucket via `@advance-labs/mcp-core`) and return structured errors
  rather than leaking stack traces.
- **The crawler is polite:** respects `robots.txt`, identifies itself via User-Agent, and rate-limits per host.
- **GitHub Actions** never interpolate untrusted input into `run:` steps; secrets come from Actions secrets.

## Dependency hygiene

- MIT-licensed throughout; no AGPL/proprietary source was copied (see `docs/adr/0002-typescript-from-scratch.md`).
- `pnpm` with a committed lockfile; CI installs with `--frozen-lockfile`.
