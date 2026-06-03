# Tool 6 — GA4 + Google Search Console Chat (`apps/ga-gsc-chat`)

**Type:** Next.js (App Router) · **Deploy:** Vercel
**Depends on:** `@aeo/google-api`, `@aeo/llm`, `@aeo/ui`, `@aeo/types`

## What it does
Google OAuth (read-only) connects a user's GA4 property + verified Search Console site. The user asks
natural-language SEO questions; the app pulls GA4 + GSC data, aggregates it, and sends data + question to
the user's **own** Claude/OpenAI key (BYOK). Returns a numbered, data-grounded fix list. Ships preset
prompt cards (CTR gaps, impression declines, engagement issues, device/country splits).

## Surface
- `GET /api/auth/google` + `GET /api/auth/google/callback` — OAuth via `@aeo/google-api` `GoogleOAuth`;
  store refresh tokens via `TokenStore` (`// STUB:` in-memory now, Supabase adapter later).
- `POST /api/chat` — body `{ question, propertyId, siteUrl, llmProvider, model, apiKey }`.
  Fetch GA4 (`runReport`) + GSC (`query`) → build a compact data context → `@aeo/llm` `complete()`.
- `/` page: OAuth connect, property/site pickers, preset prompt cards, chat thread (`@aeo/ui`).

## Config / env
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (server env).
- The user's LLM API key is **never** persisted server-side — request-scoped only.

## Notes
- This is the clean-room replacement for the AGPL `agentic-seo-agent` reference (see ADR 0002).
