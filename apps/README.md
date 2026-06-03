# Apps

The 9 tools. Each is an independently-deployable package that consumes the shared engines in
[`../packages`](../packages). Full specs live in [`../docs/tools`](../docs/tools).

| App | Tool | Type | Key `@aeo/*` deps |
|-----|------|------|-------------------|
| `llm-audit` | LLM & Technical SEO Audit | Next.js | crawler, html-parser, schema-validator, scoring, pdf, ui |
| `eeat-scanner` | E-E-A-T Scanner | Next.js | crawler, html-parser, scoring, ui |
| `llms-txt-generator` | llms.txt Generator | Next.js | crawler, html-parser, ui |
| `ai-visibility-mcp` | AI Visibility MCP | MCP server | mcp-core, crawler, scoring, llm |
| `chrome-extension` | AEO/GEO Chrome Extension | MV3 (Vite) | scoring, schema-validator, html-parser |
| `ga-gsc-chat` | GA4 + GSC Chat | Next.js | google-api, llm, ui |
| `ga-gsc-mcp` | GA4 + GSC MCP | MCP server | mcp-core, google-api |
| `backlink-mcp` | Backlink MCP | MCP server | mcp-core, llm, crawler |
| `blogging-agent` | Autonomous Blogging Agent | Node pipeline | google-api, llm |
| `backlink-graph` | Backlink Graph (3D) | Next.js + WebGL | backlinks, ui |

## Running one app

```bash
pnpm --filter @aeo/llm-audit dev      # Next.js dev server
pnpm --filter @aeo/ga-gsc-mcp build   # build an MCP server
pnpm --filter @aeo/chrome-extension build
```

Each app's `README.md` documents its routes/entrypoints, required env vars, and which integrations are
live vs stubbed.
