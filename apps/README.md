# Apps

The toolkit ships as **one unified app** plus the browser extension. All tool logic lives in the shared
engines under [`../packages`](../packages); these apps are the thin composition + delivery layer.

| App | What | Deploy target |
|-----|------|---------------|
| [`console`](console) | **The whole suite in one Next.js app** — all 5 web tools as routes, the 3 MCP servers as route handlers, and the blogging agent as a Vercel Cron. One Vercel project, one domain. | Vercel |
| [`chrome-extension`](chrome-extension) | Single-page AEO/GEO audit that runs locally in the browser (zero server calls). Built from the repo, shipped via the Chrome Web Store. | Chrome Web Store |

> The former standalone tool apps (llm-audit, eeat-scanner, llms-txt-generator, ga-gsc-chat,
> backlink-graph, ai-visibility-mcp, ga-gsc-mcp, backlink-mcp, blogging-agent) were **consolidated into
> `console`** — their logic was preserved in the `@aeo/*` packages and re-homed as routes/handlers.

## Console surface

| Route | Tool / endpoint |
|-------|-----------------|
| `/` | Dashboard |
| `/tools/audit` · `/tools/eeat` · `/tools/llms-txt` · `/tools/chat` · `/tools/graph` | the 5 web tools |
| `/api/audit/*` · `/api/generate` · `/api/chat` · `/api/auth/google/*` · `/api/graph/*` | tool APIs (Node runtime) |
| `/api/mcp/{ai-visibility,ga-gsc,backlink}` + `/.well-known/*` | MCP servers (via `mcp-handler`) for Claude connectors |
| `/api/cron/blogging` | blogging agent, invoked by a Vercel Cron (`apps/console/vercel.json`) |

## Running

```bash
pnpm --filter @aeo/console dev          # the whole suite
pnpm --filter @aeo/chrome-extension build
```

See [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) for the single-deployment runbook.
