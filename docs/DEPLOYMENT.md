# Deployment

| App | Target | How |
|-----|--------|-----|
| `llm-audit`, `eeat-scanner`, `llms-txt-generator`, `ga-gsc-chat` | Vercel (Fluid Compute, Node runtime) | `vercel` per app; set root directory to the app folder |
| `ai-visibility-mcp`, `ga-gsc-mcp` | Vercel Functions (remote MCP, HTTP/SSE) | deploy `src/http.ts` entry; expose `.well-known` OAuth discovery |
| `backlink-mcp` | npm (stdio, Claude Desktop/Cursor) + Vercel (remote) | publish `src/server.ts` bin; deploy `src/http.ts` for hosted |
| `chrome-extension` | Chrome Web Store | `pnpm --filter @aeo/chrome-extension build` → upload `dist/` zip |
| `blogging-agent` | GitHub Actions (scheduled) | cron workflow runs `node dist/run.js`; secrets via Actions secrets |

## Monorepo on Vercel

Each Next.js app is a separate Vercel project pointing at its `apps/<name>` directory. Vercel detects the
workspace; set the install command to `pnpm install` at the repo root and the build command to
`pnpm --filter @aeo/<name> build` (Turborepo prunes the graph). Add `transpilePackages` for the `@aeo/*`
deps (already configured in each app's `next.config.mjs`).

## Environment variables

Never commit secrets — `.gitignore` blocks `.env*`. Each app ships a `.env.example`. Common ones:

| Var | Used by | Notes |
|-----|---------|-------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | ga-gsc-chat, ga-gsc-mcp | OAuth (read-only GA4 + GSC) |
| `MCP_PUBLIC_URL` | the MCP servers | base URL for `.well-known` discovery |
| `GROQ_API_KEY`, `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | blogging-agent | model access (bulk vs strategy) |
| Perplexity / LLM keys | ai-visibility-mcp, ga-gsc-chat | **BYOK** — passed per request, never persisted |

OAuth refresh tokens are stored via a pluggable `TokenStore` (in-memory by default; the Supabase adapter
is a marked `// STUB:` seam for production).
