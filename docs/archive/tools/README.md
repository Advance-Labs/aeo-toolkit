> [!WARNING]
> **Archived and historical — this does not describe the current repository.**
> Written before the consolidation in [ADR-0003](../../adr/0003-single-vercel-deployment.md); the `apps/` layout and package list below no
> longer exist. Kept for design history only. See [the archive index](../README.md) for what replaced it.

---

# Tool Specifications

One spec per tool. Each maps to an app under `apps/` and reuses the shared engines under `packages/`.

| # | Spec | App | Type |
|---|------|-----|------|
| 1 | [LLM & Technical SEO Audit](01-llm-audit.md) | `apps/llm-audit` | Next.js |
| 2 | [E-E-A-T Scanner](02-eeat-scanner.md) | `apps/eeat-scanner` | Next.js |
| 3 | [llms.txt Generator](03-llms-txt-generator.md) | `apps/llms-txt-generator` | Next.js |
| 4 | [AI Visibility MCP](04-ai-visibility-mcp.md) | `apps/ai-visibility-mcp` | MCP server |
| 5 | [Chrome Extension](05-chrome-extension.md) | `apps/chrome-extension` | MV3 extension |
| 6 | [GA4 + GSC Chat](06-ga-gsc-chat.md) | `apps/ga-gsc-chat` | Next.js |
| 7 | [GA4 + GSC MCP](07-ga-gsc-mcp.md) | `apps/ga-gsc-mcp` | MCP server |
| 8 | [Backlink MCP](08-backlink-mcp.md) | `apps/backlink-mcp` | MCP server |
| 9 | [Blogging Agent](09-blogging-agent.md) | `apps/blogging-agent` | Actions pipeline |
| 10 | [Backlink Graph (3D)](10-backlink-graph.md) | `apps/backlink-graph` | Next.js + WebGL |

See [`../BUILD-PLAN.md`](../BUILD-PLAN.md) for the consolidated roadmap and [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
for the reuse model.
