<p align="center"><img src="../../brand/logo.svg" alt="AEO Toolkit" width="280"></p>

# AEO Toolkit Console

> The **unified SaaS surface** — every tool, MCP endpoint, and the blogging cron in one Next.js app,
> deployed as a **single Vercel project** on one domain.

## What's inside
| Path | What |
|------|------|
| `/` | Dashboard / tool launcher |
| `/tools/audit` · `/tools/eeat` · `/tools/llms-txt` · `/tools/chat` · `/tools/graph` | the 5 web tools |
| `/api/audit/*`, `/api/generate`, `/api/chat`, `/api/auth/google/*`, `/api/graph/*` | tool APIs (Node runtime) |
| `/api/mcp/ai-visibility`, `/api/mcp/ga-gsc`, `/api/mcp/backlink` | remote MCP servers (via `mcp-handler`) |
| `/.well-known/*` | MCP OAuth discovery for Claude.ai connectors |
| `/api/cron/blogging` | the autonomous blogging agent, run by a **Vercel Cron** (see `vercel.ts`) |

All logic lives in the shared `@aeo/*` packages; this app is the thin composition layer.

## Run
```bash
pnpm --filter @aeo/console dev
```

## Deploy (single Vercel project)
- Import the repo → **Root Directory = `apps/console`**, framework Next.js, install at repo root with pnpm.
- Set the env vars from `.env.example` (one set for the whole suite).
- Crons are declared in `vercel.ts`. Add the backing services (Supabase, Upstash, Google OAuth) per
  [`../../docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md).

The Chrome extension (`apps/chrome-extension`) is built separately and offered as a download — it runs
in the browser, not on Vercel.

## Status
🚧 Consolidation in progress — replaces the former standalone tool apps (logic preserved in `@aeo/*`).
