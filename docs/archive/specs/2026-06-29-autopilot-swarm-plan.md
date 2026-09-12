> [!WARNING]
> **Archived and historical — this does not describe the current repository.**
> Written before the consolidation in [ADR-0003](../../adr/0003-single-vercel-deployment.md); the `apps/` layout and package list below no
> longer exist. Kept for design history only. See [the archive index](../README.md) for what replaced it.

---

# Autopilot Managed Layer — Implementation Swarm Plan (v1)

> Companion to `2026-06-29-autopilot-managed-layer-design.md` (spec v1.1).
> Build executed by an agent swarm in dependency-gated phases, in the style of `docs/BUILD-PLAN.md §5`.
> **Rules (inherited):** each agent owns exactly one package/app directory, never edits root files, never
> runs `pnpm install` (one central install/build per phase by the lead). Every new surface: injected I/O,
> env-gated, ships dormant. Scope is **revised v1** per spec §0.7 — orchestrator + outreach + managed tier +
> security primitives + legal layer. Marketplace and Reddit are explicitly **out of v1**.

---

## 0. Build order (dependency graph)

```
existing reuse layer (unchanged): types · crawler · html-parser · scoring · llm · google-api · storage · backlinks · blogging
        │
Phase 0 (lead) ── lock @advance-labs/types additions · security conventions · ownership map · legal stubs
        │
Phase 1 (parallel) ── @advance-labs/net-guard (C1)   @advance-labs/storage hardening (H4)   @advance-labs/orchestrator (core)
        │                     └──────────── verify barrier (lead) ────────────┘
        │
Phase 2 (sequenced) ── (2a entitlements ∥ 2b schema/auth) → 2c managed routes+inbox+trigger → 2d guarantee/pricing UI
        │                     └──────────── verify barrier (lead) ────────────┘
        │
Phase 3 (lead + human) ── legal layer review · dormant/security/e2e proof · docs · PR
```

**Keystone:** `@advance-labs/types` additions (the proposal/customer/job shapes) — lock these in Phase 0 before any
agent builds against them, exactly as `@advance-labs/scoring`'s `Score`/`Finding` shapes were locked in the original build.

---

## 1. Phase 0 — Lead (no parallelism)

Removes write-contention and locks contracts. Deliverables:

1. **`@advance-labs/types` additions** (single source of truth; lock before Phase 1):
   - `CustomerProfile` (siteUrl, niche/topics[], cadence targets, connected integrations, ownerId).
   - `Proposal` discriminated union: `ContentProposal | LinkOutreachProposal` (v1); `LinkPlacementProposal |
     CommunityReplyProposal` typed but marked `@deferred`. Each: `id, customerId, ownerId, kind, status
     ('pending'|'approved'|'rejected'|'executed'|'failed'), payload, createdAt, decidedBy, decidedAt`.
   - `JobResult`, `JobKind = 'content.generate' | 'link.outreach'`, `CadenceTarget`.
   - `SafeFetchResult` (for net-guard), `TokenProvider = 'google' | 'reddit' | 'cms'` (for the composite key).
2. **`docs/CONVENTIONS-autopilot.md`** — the security invariants every agent must follow, lifted from spec
   §0.6: SSRF-guarded fetch only, service-role writes behind ownership checks, no-plaintext-tokens,
   data-not-instructions for LLM inputs, schema-validated LLM output, `href` allowlist, managed-inert-when-dormant.
3. **Ownership map** (below) committed so no two agents share a file.
4. **Legal stubs** — create `docs/legal/MSA-managed.md` and `docs/legal/guarantee-terms.md` as TODO
   skeletons (content is a human/counsel task; tracked, not auto-written). Flag as a release gate.

**Ownership map (no two builders share a file):**

| Files / dirs | Owner |
|---|---|
| `packages/net-guard/**` (new) | **net-guard** |
| `packages/storage/src/token-store.ts`, `crypto.ts`, `supabase/*token*` migration | **storage-harden** |
| `packages/orchestrator/**` (new) | **orchestrator** |
| `apps/console/src/lib/billing/plans.ts`, `entitlements.ts` | **entitlements** |
| `apps/console/supabase/schema-managed.sql`, `src/lib/auth/*` additions, OAuth `state` | **schema-auth** |
| `apps/console/src/app/(internal)/inbox/**`, `app/onboarding/**`, `app/api/orchestrator/**`, `app/api/managed/**` | **managed-routes** |
| `apps/console/src/app/account/**` (guarantee), `app/pricing/**` (managed card) | **guarantee-ui** |
| `@advance-labs/types`, root docs, `.env.example`, deps, CI | **lead** |

---

## 2. Phase 1 — Core packages (parallel; depend only on types + existing reuse layer)

### Agent `net-guard` → `packages/net-guard` (new) — closes **C1**
A tiny, ruthlessly-tested package: `safeFetch(url, opts, deps)` with injected DNS resolver + fetch.
- Scheme allowlist (`http`/`https`); resolve DNS; reject loopback/link-local/private/CGNAT/metadata
  (IPv4 + IPv6 incl. `::1`, `fc00::/7`, mapped `::ffff:`); `redirect:'manual'` + re-validate every hop;
  timeout + max-body cap; host-pin to the validated IP (DNS-rebind defense).
- Pure unit tests with a fake resolver: assert 169.254.169.254, localhost, 10.x, redirect-to-internal,
  and rebind all rejected; public host allowed. **Zero network in tests.**
- Consumed in Phase 1/2 by the orchestrator's `OutreachRunner` for any prospect-page fetch.

### Agent `storage-harden` → `packages/storage` (edit only token-store/crypto + migration) — closes **H4**
- `TokenStore`: **remove the plaintext fallback** — constructing without an `encryptionKey` throws (or a
  separate `requireEncryption: true` path the managed tier uses). Existing callers unaffected (they pass keys).
- Re-key `oauth_tokens` to composite `(user_id, provider)`; ship an **additive** migration
  (`supabase/2026-06-29-token-provider.sql`) — do not break the existing single-provider Google rows
  (backfill `provider='google'`).
- Add a `v1:`/key-id prefix to serialized ciphertext + a `docs/` rotation runbook. Unit-test encrypt→decrypt
  round-trip across key versions and the no-key throw.

### Agent `orchestrator` → `packages/orchestrator` (new) — the product spine
Depends on `@advance-labs/blogging`, `@advance-labs/backlinks`, `@advance-labs/storage`, `@advance-labs/net-guard`, `@advance-labs/types`. **Must not
import from `apps/console`** (dependency-direction trap).
- **Cadence core (pure):** `dueJobs(profile, now)` → which jobs are due this period; deterministic via
  injected `clock`; idempotent dedupe key `customer+jobKind+period`. Exhaustive unit tests.
- **`ProposalStore`** interface + `SupabaseProposalStore` impl on `createSupabaseClient` (mirrors
  `@advance-labs/blogging`'s `SupabasePostStore`). In-memory impl for tests.
- **`ContentRunner`:** composes `@advance-labs/blogging` sub-agents `findQueryGaps → gapToBrief → runResearch →
  runWriter → runEditor`, **stops before schedule/publish**, emits a `ContentProposal` (draft `Post`).
  Builds `PipelineDeps` per customer (their BYOK key + Google token from the hardened `TokenStore`).
  **Injection hardening:** scraped research text delimited as data; editor/writer output schema-validated.
- **`OutreachRunner`:** wraps `@advance-labs/backlinks` discovery/outreach (`find_prospects`, `extract_contact_info`,
  `generate_outreach_email`) → emits `LinkOutreachProposal`. Any prospect-page fetch goes through
  `@advance-labs/net-guard.safeFetch`. Drafted outreach email schema-validated; no model-derived send targets.
- **Graduated-autonomy gate (pure):** `shouldAutoExecute(proposal, policy)` — content above a confidence
  threshold may auto-publish (first-party CMS only); outreach always returns `false` (human-gated). Unit-tested.
- **`runCadence(profile, deps)`** ties it together; returns `JobResult[]`; writes proposals to the store.
  All deps injected → fully offline-testable.

**Verify barrier (lead):** `pnpm install` once; `turbo run build typecheck test --filter=./packages/*`;
fix integration; confirm net-guard rejects the SSRF set and TokenStore migration applies cleanly.

---

## 3. Phase 2 — Console Managed tier (depends on verified Phase 1)

Sequencing inside the phase: **(2a ∥ 2b) → 2c → 2d** (2c reads the new tables + entitlements; 2d reads 2c).

### Agent `entitlements` → `billing/plans.ts` + `entitlements.ts` — closes **M1**, feasibility-§0.5
- Add `managed` to `PlanId`/`PLANS` ($499–999/site default, clearly editable); extend `Plan.limits` with
  managed quotas (`articlesPerMonth`, `outreachPlacementsPerMonth`, `sites`).
- Extend `Feature` union with `'managed'`; extend `evaluateEntitlement` for managed quotas.
- **Fix `planFor()`** so active managed subscriptions resolve to `managed` (today it hardcodes pro/agency →
  silent downgrade).
- **Managed carve-out:** unlike the fail-open free tools, the `managed` feature requires auth + active
  entitlement and returns **inert/closed** when managed env is absent. Pure-core tests for the new matrix +
  a dormant test (no managed env → managed inert, existing tools unchanged).

### Agent `schema-auth` → `supabase/schema-managed.sql` + `lib/auth/*` — closes **C2 (data), H5, M4**
- New additive RLS tables: `customer_profiles`, `proposals`, `proposal_audit` (append-only — **no**
  update/delete policy even for owner; service-role writes only), `managed_jobs`. User reads own rows;
  service-role writes. Header documents the `psql -f` apply.
- OAuth `state` + PKCE + `redirect_uri` allowlist for the CMS connect flow; persist tokens against the
  **session user**, via the hardened `(user_id, provider)` `TokenStore`. Mirror existing `auth/callback`.

### Agent `managed-routes` → `app/(internal)/inbox`, `app/onboarding`, `app/api/orchestrator`, `app/api/managed` — closes **C2 (authz), H1, H3**
- **Internal staff approval inbox** (`(internal)` — staff-role gated, not customer-facing): list `pending`
  proposals, approve/reject/edit. **Every action:** resolve session → load proposal → assert staff role OR
  `proposal.owner_id === session.user.id` → execute. Approving content → publish via `@advance-labs/blogging`
  `Publisher` with **sanitized** output (escape, single allowlisted `href`); approving outreach → mark sent.
- **Onboarding** (`/onboarding`): runs existing audit + `@advance-labs/blogging` `findQueryGaps` + `ai-visibility`
  baseline (console-local) → topic clusters + 30-day calendar + captured guarantee baseline.
- **Orchestrator trigger** (`/api/orchestrator/run`): out-of-band worker auth — constant-time job secret
  (distinct from Stripe's); per-`customer_id` scoping; service-role module isolated from request handlers.
  Calls `@advance-labs/orchestrator.runCadence`.

### Agent `guarantee-ui` → `app/account` + `app/pricing` — supports §0.4
- `/account` managed panel: baseline vs. current (citation coverage on target prompts + GSC), delivery
  SLA progress (articles/placements vs. plan), and a link to the guarantee **T&Cs** (from the legal stub).
  Renders terms/exclusions, not just a delta chart.
- `/pricing`: add the Managed card (per-site, 3-mo min, "human-vetted, penalty-safe, guaranteed"), CTA →
  contact/checkout. Positioning copy per spec §0.3 (not "compliant BLG").

**Verify barrier (lead):** `pnpm --filter @advance-labs/console typecheck && build && test`; **dormant proof**
(no managed env → managed routes inert, existing free tools identical — asserted test); **security tests**
(cross-tenant inbox approve rejected; SSRF set blocked through the outreach path; injection payload in
research/thread text doesn't alter `href`/output schema); 375px mobile + zero console errors on
`/pricing`/`/onboarding`.

---

## 4. Phase 3 — Lead + human (close-out)

- **Legal layer review gate:** MSA + guarantee T&Cs reviewed by counsel before the tier can be marketed
  with the guarantee (spec §0.4). This is a *release blocker*, not a code task.
- Final `.env.example` (all new env dormant), `docs/DEPLOYMENT.md` managed section, CI green.
- Commit on `plan/autopilot-managed-layer`; open PR to `main` with the dormant-proof + security-test evidence.

---

## 5. Deferred to v1.5 (separate spec → swarm cycle each)

Not built now; each gets its own brainstorm → spec → swarm pass when triggered:
- **`@advance-labs/link-exchange`** — only after the followed-vs-`nofollow` lane is decided (spec §0.1), with
  domain-ownership verification (M2), append-only consent log, and **seeded from the existing customer base**
  (solve cold-start internally before opening externally).
- **`@advance-labs/community`** — after confirming Reddit commercial API licensing/cost, with read-only access, FTC
  affiliation-disclosure prompts, cross-customer rate/diversity gates, and no posting capability in the package.
- **Infographics + multi-language** content add-ons to `@advance-labs/blogging`.

---

## 6. Swarm summary (what runs, when)

| Phase | Agents (parallel within phase) | Gated by |
|---|---|---|
| 0 | lead (types lock, conventions, ownership, legal stubs) | — |
| 1 | `net-guard` · `storage-harden` · `orchestrator` | Phase 0 types lock |
| 1-verify | lead | all Phase 1 |
| 2 | `entitlements` ∥ `schema-auth` → `managed-routes` → `guarantee-ui` | verified Phase 1 |
| 2-verify | lead (dormant + security + mobile proofs) | all Phase 2 |
| 3 | lead + human (legal gate, PR) | verified Phase 2 |

Total v1 build agents: **7** (3 in Phase 1, 4 in Phase 2) + lead. Two CRITICAL security controls
(`net-guard`/C1, ownership-authz/C2) are first-class build tasks, not afterthoughts.
