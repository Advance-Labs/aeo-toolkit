# Commercial Layer + MCP Page — Design Contract v1.0

Binding contract for two workstreams on `apps/console`. Builders implement against this; where a
builder disagrees, this doc wins. Grounded in the existing patterns: Supabase is reached **service-role
only** (`@advance-labs/storage` `createSupabaseClient({ url, serviceKey })`), RLS is on with no permissive
policies, tool API routes are `runtime='nodejs'` `dynamic='force-dynamic'` POST handlers returning JSON.

Guiding principle (matches the repo's "lights up when creds are added" convention, e.g. ga-gsc):
**everything new is env-gated and ships dormant**. With no new env set, the site behaves exactly as
today (all tools free and open); billing/auth activate only when their env vars are present. No new
code may break the currently-live free tools.

---

## PART A — MCP connection page (`/mcp`) — independent, ships live

The footer links (`/api/mcp/<slug>/mcp` for each server) point at MCP Streamable-HTTP
protocol endpoints — they 404 in a browser. Build a human page that documents and connects them.

### A1. Shared tool metadata — `apps/console/src/lib/mcp-catalog.ts` (owner: mcp-page builder)
Single source of truth, hand-authored from the server registrations (do NOT execute the servers).
```ts
export interface McpToolMeta { name: string; summary: string }
export interface McpServerMeta {
  slug: 'ai-visibility' | 'ga-gsc' | 'backlink';
  name: string;            // "AI Visibility MCP"
  blurb: string;           // one sentence
  endpoint: string;        // `${SITE_URL}/api/mcp/<slug>/mcp` — build from seo.ts SITE_URL
  auth: 'none' | 'google-byok';
  status: 'live' | 'needs-google';
  tools: McpToolMeta[];
}
export const MCP_SERVERS: McpServerMeta[];   // all 3, with the exact 19 tools below
```
Tool lists (names verbatim; write a crisp one-line summary for each from the server source docstrings):
- **ai-visibility** (auth none, live): `analyze_website_aeo`, `check_ai_visibility`, `discover_ranking_prompts`, `get_visibility_report`, `compare_competitor_visibility`
- **backlink** (auth none, live): `find_prospects`, `find_mentions`, `extract_contact_info`, `check_page_history`, `generate_outreach_email`, `verify_page_links`, `find_competitor_link_sources`
- **ga-gsc** (auth google-byok, needs-google): `list_ga4_properties`, `list_gsc_sites`, `ga4_run_report`, `gsc_search_analytics`, `gsc_top_queries`, `gsc_ctr_gaps`, `compare_periods`

### A2. Page — `apps/console/src/app/mcp/page.tsx` (owner: mcp-page builder)
- Metadata via `buildToolMetadata`/`seo.ts` (canonical `/mcp`), JSON-LD `SoftwareApplication`/`ItemList`.
- Match the existing landing design system exactly (read `components/landing/*`, `components/ui/*`:
  `Section`, `Container`, `Badge`, `GradientText`, `Reveal`, `SpotlightCard`). Dark theme, same rhythm.
- Hero: "Connect the AEO Toolkit to your AI client" + one-paragraph explainer of what MCP is for a
  beginner ("Model Context Protocol lets Claude, Cursor, and other AI clients call these tools directly").
- One `SpotlightCard` per server: name, blurb, a **connection URL** (copyable, mono), an auth note,
  a collapsible/listed set of its tools (name + summary), and an **"Add to Claude.ai"** block with the
  exact steps (Settings → Connectors → Add custom connector → paste the URL; ga-gsc adds "sign in with
  Google when prompted"). Include a Cursor `mcp.json` snippet (`{"mcpServers":{"<slug>":{"url":"..."}}}`).
- A short "What you can ask" examples list per server (2–3 natural-language prompts).
- Accessibility: copy buttons have aria-labels; mono URLs in `<code>`; `grid-cols-1` base on every grid.

### A3. Footer repoint — `apps/console/src/components/ui/Footer.tsx` (owner: mcp-page builder)
Change the three MCP `href`s from `/api/mcp/*` to `/mcp` (anchor to each, e.g. `/mcp#ai-visibility`).
Keep labels. The raw endpoints stay reachable for actual MCP clients; humans land on `/mcp`.

### A4. Nav — add "MCP" to the header nav if a nav component lists tools (read `components/ui/` header).

---

## PART B — Commercial layer (auth + billing + gating) — ships dormant, activates with creds

### B1. Pricing model — `apps/console/src/lib/billing/plans.ts` (owner: billing builder)
Configurable single source of truth. **Default tiers (the user can edit prices/limits here):**
```ts
export type PlanId = 'free' | 'pro' | 'agency';
export interface Plan {
  id: PlanId; name: string; priceUsdMonthly: number;
  stripePriceEnv: string | null;        // env var holding the Stripe price id (null for free)
  limits: { auditsPerMonth: number; mcpAccess: boolean; seats: number }; // -1 = unlimited
  blurb: string; features: string[];
}
export const PLANS: Record<PlanId, Plan>;
```
Defaults: **Free** $0 — 5 audits/mo, no MCP, 1 seat. **Pro** $29/mo — 200 audits/mo, MCP access, 1 seat.
**Agency** $99/mo — unlimited audits, MCP, 5 seats. (Clearly marked editable; these are starting points.)
`export function planFor(subscriptionStatus): PlanId` resolves an active subscription → plan, default `free`.

### B2. DB schema — `apps/console/supabase/schema-billing.sql` (owner: schema/auth builder)
New file (additive; do not edit the existing `schema.sql`). Tables, all with RLS + policies so a signed-in
user reads only their own row (this is the FIRST policy-bearing RLS in the project — the service role
still bypasses for webhooks):
- `profiles` (`id uuid pk references auth.users`, `email text`, `stripe_customer_id text`, `created_at`)
- `subscriptions` (`user_id uuid pk references auth.users`, `stripe_subscription_id text`, `status text`,
  `price_id text`, `plan text`, `current_period_end timestamptz`, `cancel_at_period_end bool`)
- `usage_events` (`id bigserial pk`, `user_id uuid`, `feature text`, `created_at timestamptz default now()`,
  index on `(user_id, created_at)`)
RLS: `select` policy `auth.uid() = id|user_id` on each; no `insert/update` for anon (writes are
service-role from webhook + server actions). Include an `on auth.users insert` trigger that seeds `profiles`.
Header comment documents `psql "$POSTGRES_URL" -f apps/console/supabase/schema-billing.sql`.

### B3. Supabase Auth (magic-link) — owner: schema/auth builder
- Add deps: `@supabase/ssr`. Use the **anon/publishable** key (new env `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
  `NEXT_PUBLIC_SUPABASE_URL` already exists). The existing service-role client stays for server/webhook use.
- `apps/console/src/lib/auth/server.ts`: `createServerSupabase()` (cookies via `@supabase/ssr`),
  `getSession()`, `getUser()` (returns null when auth env absent — dormant).
- `apps/console/src/lib/auth/client.ts`: browser client factory.
- `apps/console/src/app/login/page.tsx`: email magic-link form (`signInWithOtp`), matches design system,
  graceful "auth not configured" state when env missing.
- `apps/console/src/app/auth/callback/route.ts`: exchanges the code, redirects to `/account`.
- `apps/console/src/lib/auth/AUTH_ENABLED`: boolean = both NEXT_PUBLIC_SUPABASE_ANON_KEY + URL present.

### B4. Stripe — owner: billing builder (env-gated by `BILLING_ENABLED` = STRIPE_SECRET_KEY present)
- Add dep `stripe`. `apps/console/src/lib/billing/stripe.ts`: lazy singleton `getStripe()` (throws clear
  error only if called while unconfigured), `BILLING_ENABLED` flag.
- `POST /api/billing/checkout`: requires session; creates/fetches the Stripe customer (store id on
  `profiles`), creates a Checkout Session for the requested plan's price, returns `{ url }`.
- `POST /api/billing/portal`: requires session; returns a Billing Portal URL for the customer.
- `POST /api/billing/webhook`: `runtime='nodejs'`, raw-body signature verify with `STRIPE_WEBHOOK_SECRET`;
  handle `checkout.session.completed`, `customer.subscription.{created,updated,deleted}` → upsert
  `subscriptions` (service-role). Idempotent. Returns 200 fast. NO auth (Stripe-signed).
- New env (document in `.env.example`, all dormant): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_AGENCY`.

### B5. Entitlements/gating — `apps/console/src/lib/billing/entitlements.ts` (owner: gating builder)
The keystone. One helper used by tool routes + MCP routes:
```ts
export interface Entitlement { plan: PlanId; userId: string | null; allow: boolean; reason?: string }
export async function checkEntitlement(req: Request, feature: 'audit'|'mcp'|'graph'|'chat'):
  Promise<{ ok: true; userId: string|null; plan: PlanId } | { ok: false; status: 402|429|401; body: object }>;
```
**Dormant-safe semantics (critical):** if `!BILLING_ENABLED`, ALWAYS return `{ ok: true, plan: 'free' }`
— the site stays fully open exactly as today. Only when billing is enabled does it: resolve the session
(401 if the feature requires auth and none), resolve the plan, check the monthly usage quota against
`PLANS[plan].limits` via `usage_events` (429 with upgrade hint when exceeded), check `mcpAccess` for MCP
(402 when the plan lacks it), and record a `usage_events` row on success. Pure-function core
(`evaluateEntitlement(plan, usageCount, feature)`) is unit-tested exhaustively.
- Wire into the 5 tool API routes (`/api/audit/*`, `/api/generate`, `/api/chat`, `/api/graph/*`) at the
  top of each POST (one line: early-return the 402/429/401 response). Wire into the 3 MCP routes before
  the transport hand-off (alongside the existing `enforceWebRateLimit`).

### B6. Account dashboard — `apps/console/src/app/account/page.tsx` (owner: gating builder)
Requires session (redirect to `/login` when enabled; "billing not configured" notice when dormant).
Shows: current plan, this-month usage vs limit (from `usage_events`), upgrade buttons (→ checkout),
"Manage billing" (→ portal), sign-out. Plus a `/pricing` page (`app/pricing/page.tsx`) rendering `PLANS`
as cards with CTAs (→ checkout when signed in, → `/login` otherwise). Add "Pricing" to header nav + footer.

### B7. Middleware — `apps/console/src/middleware.ts`
Supabase SSR session refresh on `/account`, `/api/billing/*` (skip when AUTH disabled). Do not gate
public routes. Keep matcher tight.

---

## Ownership map (no two builders share a file)
| Files | Owner |
|---|---|
| `lib/mcp-catalog.ts`, `app/mcp/page.tsx`, `components/ui/Footer.tsx`, header nav | **mcp-page** |
| `supabase/schema-billing.sql`, `lib/auth/*`, `app/login/*`, `app/auth/callback/*`, `middleware.ts` | **auth** |
| `lib/billing/plans.ts`, `lib/billing/stripe.ts`, `app/api/billing/*` | **billing** |
| `lib/billing/entitlements.ts` (+ wiring edits to the 8 tool/MCP routes), `app/account/page.tsx`, `app/pricing/page.tsx` | **gating** |
| `.env.example`, `docs/DEPLOYMENT.md` billing section, deps in `apps/console/package.json` | **assembly** |

Sequencing: mcp-page ∥ (auth → billing → gating). gating reads auth + billing APIs, so it runs after both.

## Quality gates (every builder runs its slice; assembly runs all)
- `pnpm --filter @advance-labs/console typecheck` clean · `pnpm --filter @advance-labs/console build` green
- `pnpm --filter @advance-labs/console test` — entitlement pure-core + plan-resolution + webhook-handler unit tests pass
- Dormant proof: with NO new env, `checkEntitlement` returns ok for every feature; `/mcp`, `/pricing`
  render; tool routes behave exactly as today. (A test asserts this.)
- `/mcp` and `/pricing` mobile 375px: `scrollWidth === 375`, zero console errors (playwright in verify).

## Out of scope (v1)
Team/seat management UI, annual prices, coupons, proration UX, email receipts beyond Stripe's,
per-tool granular quotas beyond `auditsPerMonth` + `mcpAccess`, SSO. Pricing numbers are defaults to tune.
