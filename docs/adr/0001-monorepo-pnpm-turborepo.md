# ADR 0001 — pnpm + Turborepo monorepo

- **Status:** Accepted
- **Date:** 2026-06-02

## Context
Nine tools share a crawl/parse/score pipeline and an MCP middleware layer. Building them as separate
repos would duplicate the engines and fork their fixes.

## Decision
Single monorepo using **pnpm workspaces** (content-addressed store, strict deps, `workspace:*` linking)
and **Turborepo** (task graph, caching, `^build` ordering). Shared engines live in `packages/`,
tools in `apps/`.

## Consequences
- Reuse layer is built once; second audit tool is days not weeks.
- One toolchain, one CI, atomic cross-cutting changes.
- Workspace globs (`packages/*`, `apps/*`) let parallel agents add packages without touching root files.
- Cost: contributors learn the workspace model; tooling (turbo) added to the chain.
