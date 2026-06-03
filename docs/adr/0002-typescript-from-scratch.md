# ADR 0002 — TypeScript-first clean-room rebuild (no forks)

- **Status:** Accepted
- **Date:** 2026-06-02

## Context
The reference plan names OSS foundations in Go (SEOnaut), Python (LibreCrawl, several MCPs), and Node.
One (`agentic-seo-agent`) is **AGPL-3.0**, which infects network-served derivatives.

## Decision
Rebuild every tool **from scratch in TypeScript**, using the referenced repos only as behavioral
references — not forks. One language, one toolchain across all 20 units.

## Consequences
- Clean MIT ownership; no AGPL obligations on a hosted product.
- Maximum reuse — all tools import the same TS engines instead of bridging across languages.
- Cost: more upfront implementation than forking; mitigated by the shared-engine architecture.
- Python/Go repos remain valuable as algorithm references (scoring weights, crawl politeness, MCP tool shapes).
