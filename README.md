# AEO Toolkit

> Open-source suite of **9 Answer-Engine-Optimization / technical-SEO / AI-visibility tools**, rebuilt
> from scratch as a TypeScript monorepo by [Advance Labs Inc.](https://github.com/Advance-Labs)

AEO Toolkit helps websites rank inside LLM answer engines (ChatGPT, Claude, Perplexity, Google AI
Overviews) the way classic SEO helped them rank in search. It packages a shared crawl → parse → score
engine and reuses it across a family of audit tools, MCP servers, and content agents.

## The 9 tools

| # | Tool | What it does |
|---|------|--------------|
| 1 | **LLM & Technical SEO Audit** | Crawls up to 50 pages, scores technical SEO + AEO signals out of 100, prioritized fix list + file templates |
| 2 | **E-E-A-T Scanner** | Samples 12 pages, scores Experience / Expertise / Authoritativeness / Trust |
| 3 | **llms.txt Generator** | Crawls a site and generates `llms.txt` / `llms-full.txt` crawl-hint manifests |
| 4 | **AI Visibility MCP** | Remote MCP server: AEO analysis + Perplexity citation checks for Claude |
| 5 | **Chrome Extension** | Real-time single-page AI-readiness audit (21+ checks), local-only, PDF export |
| 6 | **GA4 + GSC Chat** | Natural-language SEO chat grounded in your real Google Analytics + Search Console data (BYOK) |
| 7 | **GA4 + GSC MCP** | Remote MCP server exposing GA4 + GSC as Claude tools |
| 8 | **Backlink MCP** | Brand mentions, prospects, contact extraction, link verification, outreach drafts |
| 9 | **Blogging Agent** | Multi-agent content pipeline (strategy → research → write → edit → schedule → monitor → self-correct) |

## Architecture

A small set of shared engines under `packages/` powers every tool under `apps/`:

- `@aeo/crawler` · `@aeo/html-parser` · `@aeo/schema-validator` · `@aeo/scoring` — the audit pipeline
- `@aeo/mcp-core` — shared MCP transport / OAuth / rate-limit middleware
- `@aeo/google-api` · `@aeo/llm` — data + AI connectors (BYOK)
- `@aeo/pdf` · `@aeo/ui` · `@aeo/types` · `@aeo/config` — reports, design system, types, toolchain

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/BUILD-PLAN.md`](docs/BUILD-PLAN.md).

## Quick start

```bash
pnpm install          # install the whole workspace
pnpm build            # build every package + app (turbo, dependency-ordered)
pnpm typecheck        # strict type-check across the workspace
pnpm test             # run all Vitest suites
pnpm dev              # run dev servers
```

Work on one tool:

```bash
pnpm --filter @aeo/llm-audit dev
pnpm --filter @aeo/scoring test
```

## Status

🚧 **Active build-out.** Shared engines are the priority and built deepest; data/agent tools ship as
runnable scaffolds with clearly-marked stubbed integrations. Each package's `README.md` states what is
implemented vs stubbed.

## License

MIT © Advance Labs Inc. Built clean-room in TypeScript; no AGPL/proprietary source was copied.
