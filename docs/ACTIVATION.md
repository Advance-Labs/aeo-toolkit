---
title: Activation runbook
description: >-
  The console ships dormant. Turn on Supabase Auth and Stripe billing by adding keys, and roll back by removing them.
---

The console ships **dormant**: with none of the env vars below set, the site runs exactly as it does
today — all five tools free and open, no sign-in, no paywall. The commercial layer (Supabase Auth +
Stripe billing + usage gating) and the MCP servers are fully built; this runbook turns them on.

Two independent switches, each derived from whether its keys are present (there is no separate on/off flag):

| Switch | On when… | Unlocks |
|--------|----------|---------|
| `AUTH_ENABLED` | `NEXT_PUBLIC_SUPABASE_URL` **and** `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set | `/login`, sessions, `/account` |
| `BILLING_ENABLED` | `STRIPE_SECRET_KEY` is set | checkout, the customer portal, plan/quota gating |

You can enable Auth without Billing (accounts, no charging). Billing without Auth is not useful —
enable Auth first.

> **Dormant safety:** until `BILLING_ENABLED` is true, `checkEntitlement()` returns "allow" for every
> request, so adding these keys is the *only* thing that can ever wall a tool. Roll back instantly by
> unsetting `STRIPE_SECRET_KEY` (see [§5](#5-rollback)).

---

## 1. Supabase Auth

1. **Anon key.** Supabase dashboard → Project → Settings → API. Copy the **anon / publishable** key
   (not the service role key — that one is already set as `SUPABASE_SERVICE_ROLE_KEY`).
   ```bash
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production --scope advancelabs   # paste the anon key
   # NEXT_PUBLIC_SUPABASE_URL is already set; if not, add it (the https://<ref>.supabase.co URL).
   ```
2. **Apply the billing schema** (profiles + subscriptions + usage_events, with RLS policies and the
   profile-seeding trigger). Run once:
   ```bash
   psql "$POSTGRES_URL" -f apps/console/supabase/schema-billing.sql
   # …or paste the file into the Supabase SQL editor.
   ```
3. **Email auth + redirect.** Supabase dashboard → Authentication → Providers → enable **Email**
   (magic link). Under URL Configuration add the callback to the allowed redirect URLs:
   `https://aeo.advancelabs.dev/auth/callback`.

After a redeploy, `/login` accepts a magic link and `/account` is reachable once signed in.

## 2. Stripe billing

1. **Create the products/prices** (Stripe dashboard → Products, or the API). One recurring monthly price
   per paid plan. Note each `price_…` id.
2. **Set the keys** (use **test mode** keys first; swap to live when ready):
   ```bash
   vercel env add STRIPE_SECRET_KEY production --scope advancelabs                 # sk_test_… / sk_live_…
   vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production --scope advancelabs # pk_test_… / pk_live_…
   vercel env add STRIPE_PRICE_PRO production --scope advancelabs                   # price_… (Pro)
   vercel env add STRIPE_PRICE_AGENCY production --scope advancelabs                # price_… (Agency)
   ```
   > Tip: the CLI's `env add` reads the value from your terminal. If a value lands empty, set it from
   > the Vercel dashboard (Project → Settings → Environment Variables) instead — same as we do for any
   > value that must be verifiable.
3. **Webhook.** Stripe dashboard → Developers → Webhooks → Add endpoint:
   - URL: `https://aeo.advancelabs.dev/api/billing/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy the signing secret and set it:
     ```bash
     vercel env add STRIPE_WEBHOOK_SECRET production --scope advancelabs            # whsec_…
     ```
   The webhook handler verifies this signature on every call and rejects anything unsigned.

## 3. Pricing (optional — defaults already ship)

Edit `apps/console/src/lib/billing/plans.ts` — the single source of truth for tiers, prices, and limits
(audits/month, MCP access, seats). The defaults are **Free $0 / Pro $29 / Agency $99**; change the
numbers, the `features` lists, or add/remove a plan here. The `/pricing` page and the gate both read
from this file, so one edit updates both. The `stripePriceEnv` field maps each plan to the env var
holding its Stripe price id (set in §2).

## 4. Deploy & verify

```bash
git push origin main          # triggers the production deploy that picks up the new env

# Auth
open https://aeo.advancelabs.dev/login            # request a magic link, confirm you reach /account

# Billing (test mode)
open https://aeo.advancelabs.dev/pricing          # pick Pro → Stripe Checkout (use card 4242 4242 4242 4242)
# back on /account: plan shows "Pro", "Manage billing" opens the Stripe portal

# Gating
#   free user past the monthly audit limit → 429 with an upgrade hint
#   a tool/MCP requiring Pro while on Free  → 402
```

## 5. Rollback

Unset `STRIPE_SECRET_KEY` (and redeploy) → `BILLING_ENABLED` goes false → every tool is open again,
no quotas, no paywall. Unset the Supabase anon key to also remove sign-in. The schema and Stripe data
are untouched and reactivate the moment the keys return.

---

## 6. Connecting the MCP servers (for end users)

The three MCP servers are live now and do **not** require any of the above to function (ga-gsc needs the
user's own Google sign-in). The human-facing connection page is **<https://aeo.advancelabs.dev/mcp>** —
it lists every tool and the connection steps. In short:

> The trailing `/mcp` is required. `mcp-handler` only answers at that transport path; the
> bare `/api/mcp/<slug>` returns its own "Not found".

| Server | URL | Auth |
|--------|-----|------|
| AI Visibility (5 tools) | `https://aeo.advancelabs.dev/api/mcp/ai-visibility/mcp` | none |
| Backlink (7 tools) | `https://aeo.advancelabs.dev/api/mcp/backlink/mcp` | none |
| GA4 + GSC (10 tools) | `https://aeo.advancelabs.dev/api/mcp/ga-gsc/mcp` | Google sign-in (BYOK) |

**Claude.ai:** Settings → Connectors → Add custom connector → paste the URL.
**Cursor** (`~/.cursor/mcp.json`):
```json
{ "mcpServers": { "aeo-ai-visibility": { "url": "https://aeo.advancelabs.dev/api/mcp/ai-visibility/mcp" } } }
```

Once Billing is on, MCP access is gated to plans whose `limits.mcpAccess` is `true` (Pro and Agency by
default); while dormant, the servers are open to all.
