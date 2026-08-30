# Autopilot — Managed Layer Design (BLG-equivalent)

> Spec v1.1 · 2026-06-29 · Owner: Advance Labs
> Adapts the BabyLoveGrowth (BLG) "done-for-you organic growth" model onto the existing
> `aeo-toolkit` monorepo. Decisions locked with the user: (1) **compliant alternatives** to BLG's
> ToS-risky features, (2) **add a done-for-you "Managed/Autopilot" tier** on top of the existing
> self-serve toolkit, (3) deliverable is an **implementation swarm plan** in the `BUILD-PLAN.md` style.
>
> **v1.1 supersedes v1.0** where they conflict. v1.0 was pressure-tested by four parallel check agents
> (feasibility, compliance/legal, security, business). Their findings materially tightened the v1 scope
> and added a security + legal layer. Section 0 below records the outcomes and is binding.

---

## 0. Check-Agent Review Outcomes (binding; supersedes conflicting earlier text)

Four independent reviews converged on the same core conclusions. Net effect: **v1 ships smaller, safer,
and positioned differently** than v1.0 proposed.

### 0.1 Business + compliance converged: cut the two risky subsystems from v1
- **`@advance-labs/link-exchange` (marketplace) → DEFERRED to v1.5.** Two independent reasons: (a) *compliance* — an
  organized link-exchange is a Google link-scheme **by intent**, regardless of relevance/consent; and the
  followed-vs-`nofollow` squeeze means the "compliant" version is either non-compliant (followed) or
  near-worthless to the customer (`nofollow`/`sponsored`). (b) *business* — a two-sided, two-approval,
  relevance-gated network has a brutal **cold-start** (zero participants vs. BLG's 4,000) and won't produce
  value for months. **Replace it in v1 with done-for-you link *outreach*** built on the already-shipped
  `@advance-labs/backlinks` discovery/outreach engine — placements on day one, no network effect, fully compliant.
- **`@advance-labs/community` (Reddit) → DEFERRED to v1.5.** Listening is genuinely safe (LOW risk); posting is
  MEDIUM (coordinated-promotion patterns + FTC disclosure aren't cured by "a human clicks post"), and
  multi-customer polling is **commercial use** that likely exceeds Reddit's free API tier (a cost/ToS item
  v1.0 ignored). It also just generates more inbox items for uncertain payoff. Defer until the core loop is proven.

### 0.2 Resolve the "done-for-you" contradiction: staff-vetted + graduated autonomy
v1.0's "nothing executes without approval, inbox in the customer console" = **done-WITH-you** (sold
convenience, shipped homework) — a worse BLG at a higher price. Binding resolution:
- **The approver is Advance Labs staff**, not the customer. This is a productized *service* with a human
  cost-of-goods, priced and staffed as one — not pure-SaaS margin. The approval inbox is **internal**.
- **Graduated autonomy:** auto-publish *first-party content to the customer's own CMS* above a confidence
  threshold (near-zero compliance risk — that's where the "magic" is); keep the genuinely risky surface
  (link outreach actions, and later community/links) human-gated. v1.0's "nothing executes without approval"
  is relaxed for first-party content only.

### 0.3 Positioning: not "compliant BLG"
Sell the downside BLG hides. Frame: **"penalty-safe, human-vetted, guaranteed, gets you *cited inside
ChatGPT/Perplexity*, and open-source-transparent"** — aimed at a *different, risk-averse buyer* (established
SMBs/agencies with a brand to protect), not BLG's cheapest-growth-hack founder. "Compliance" is the feature;
"durable growth you won't have to clean up later" is the wedge.

### 0.4 Pricing + guarantee
- **Managed tier: $499–$999/mo per site, 3-month minimum** (editable defaults). NOT $99–499 — human review
  is COGS; below ~$499/site the unit economics break. Value metric = per-site, volume-capped. (Existing
  `agency` is already $99 self-serve; managed must sit clearly above it, and `planFor()` must learn `managed`
  or managed subs silently downgrade — see 0.5.)
- **Guarantee = work-delivered SLA, never an outcome promise.** "We deliver X articles + Y outreach
  placements + measurable citation coverage on Z target prompts, or we keep working free until we do."
  Caps exposure at marginal cost (not cash refunds). Requires real **T&Cs + a claims/exclusions workflow**,
  including a clause that **customer inaction (didn't approve, blocked the bot, prior manual action) voids
  it.** Baseline capture stays, but it must encode terms/exclusions, not just a delta chart. This needs a
  **legal layer** v1.0 lacked entirely: ToS/MSA with assumption-of-risk, limitation-of-liability, indemnification.

### 0.5 Feasibility corrections (two v1.0 claims were FALSE)
- **"Reuse `@advance-labs/scoring` for relevance" — FALSE.** `@advance-labs/scoring` is a rule engine; it has no
  similarity/cosine. A `RelevanceScorer` is **net-new**. (Only relevant to the deferred marketplace.)
- **"Embeddings over declared topics/content" — embeddings DON'T EXIST in the repo** (`@advance-labs/llm` is chat-only;
  no pgvector). New dependency + per-call cost. Fallback when needed: `@advance-labs/blogging` already exports
  `tokenize`/`jaccard` dedup primitives → cheap token-overlap relevance first, defer embeddings. (Deferred-scope only.)
- **`ContentRunner` cannot wrap `runBloggingPipeline`** (single-tenant; publishes as its last step). It must
  compose the sub-agents `research→write→edit`, **stop before schedule/publish**, emit the draft as a
  `ContentProposal`, and publish only on approval — building `PipelineDeps` *per customer* with that
  customer's BYOK key + Google token.
- **Dependency-direction trap:** `ai-visibility` logic lives in `apps/console`, not a package. The console
  managed tier may use it; **`@advance-labs/orchestrator` must NOT import from `apps/console`.** `ProposalStore` and
  `RedditReadProvider` are net-new on `createSupabaseClient` + the existing Google-OAuth pattern (like
  `@advance-labs/blogging`'s `SupabasePostStore`). The commercial layer is **real and implemented**, not a doc.

### 0.6 Security controls now mandatory in v1 (designed-in, not bolted-on)
From the security review (severities verified against code):
- **C1 — SSRF guard (CRITICAL).** Any fetch of a user-supplied URL (outreach prospect fetch; later
  placement-verify) must go through a guarded HTTP seam: scheme allowlist, DNS-resolve and reject
  loopback/link-local/private/CGNAT/cloud-metadata ranges (incl. IPv6 `::1`, `fc00::/7`, mapped `::ffff:`),
  re-validate the IP on **every** redirect hop (or `redirect:'manual'`), timeout + max-body cap, host-pin to
  defeat DNS-rebind. Do **not** reuse the scraper HTTP as-is.
- **C2 — Cross-tenant authz (CRITICAL).** Inbox approve/reject/execute runs service-role (bypasses RLS).
  Every action must, in app code: resolve session user → load proposal → assert `proposal.owner_id ===
  session.user.id` (or staff role) → only then execute. Scheduled orchestrator jobs are hard-scoped to one
  `customer_id`, re-checked at execution; never trust a job-payload tenant id.
- **H1 — Scheduler auth.** Trigger out-of-band (queue/cron worker), not a public route; if HTTP, a dedicated
  constant-time job secret. Service-role key stays server-only; isolate the service-role execution module.
- **H2 — Prompt-injection.** Scraped/external text is *data, not instructions* (delimit + structured
  extraction, never concatenated into the system prompt). Constrain LLM output to a schema and validate it;
  a drafted `href` MUST equal the already-agreed target, never a model-derived URL; strip other URLs/markup.
- **H3 — Stored-XSS.** Never publish raw model HTML: emit plain text + one vetted anchor, escape/sanitize on
  insertion, allowlist the `href`, add `rel` disclosure where applicable.
- **H4 — TokenStore hardening.** Managed onboarding hard-fails if `encryptionKey` is absent (no plaintext
  fallback). Move `oauth_tokens` to composite key **`(user_id, provider)`** (Google/Reddit/CMS collide today).
  Add a key-id/version prefix to ciphertext + a rotation runbook.
- **H5 — OAuth CSRF.** Random `state` bound to the session cookie + verified on callback; PKCE where
  supported; strict `redirect_uri` allowlist; persist tokens against the authenticated session user, never a
  request-supplied id. Mirror the existing `app/auth/callback/route.ts`.
- **M1 — Managed-dormant carve-out.** `checkEntitlement` fails *open* (`free`) when billing is dormant — correct
  for existing free tools, **wrong for managed**. Add a `managed` feature that requires auth + active
  entitlement and is **inert/closed** when managed env is absent. Gate the orchestrator *enqueue/execute*, not
  just the UI.
- **M2/M4 — Marketplace abuse + audit immutability** (mostly deferred-scope): domain-ownership verification
  (DNS TXT) before a site can host/offer; the consent/approval **audit log is append-only at the DB level**
  (no update/delete policy, service-role writes).

### 0.7 Revised v1 scope (binding)
**Build in v1:** `@advance-labs/orchestrator` (cadence + ProposalStore + ContentRunner + OutreachRunner, graduated
auto-publish, injection-hardened drafting) · a guarded HTTP seam (C1) · TokenStore hardening (H4) · the
console **Managed tier** (entitlements extension, internal staff approval inbox with C2 authz, onboarding via
existing audit + `findQueryGaps` + `ai-visibility` baseline, out-of-band scheduler trigger H1, guarantee
baseline) · the **legal layer** (ToS/MSA + guarantee T&Cs — human/legal task, tracked here).
**Defer to v1.5:** `@advance-labs/link-exchange` marketplace, `@advance-labs/community` Reddit, branded infographics,
multi-language. Sections 3–5 below describe the *eventual* subsystems; for v1, only the orchestrator +
outreach + managed-tier portions are in scope.

---

## 1. Goal & Framing

BLG bundles content generation, a backlink-exchange network, technical GEO audits, a Reddit
visibility engine, and LLM-visibility tracking into a single $99/mo done-for-you subscription.

A gap analysis against this repo shows **~80% already exists**:

| BLG service | Existing equivalent in repo | Status |
|---|---|---|
| SEO/LLM content (30/mo, CMS publish) | `@advance-labs/blogging` (strategy→research→writer→editor→dedup→scheduler→monitor→self-correct + `publish/`) | Built |
| Technical GEO audit | `@advance-labs/scoring`, `apps/llm-audit`, `apps/console` | Built |
| LLM-visibility tracking | `ai-visibility` MCP (`check_ai_visibility`, `get_visibility_report`), `docs/VISIBILITY-TRACKING.md` | Built |
| Automated backlinks | `@advance-labs/backlinks` — **discovery/outreach** (find prospects, contacts, outreach), NOT an exchange network | Partial |
| Reddit visibility engine | — | Missing |
| $99 done-for-you offer | `docs/COMMERCIAL-LAYER-DESIGN.md` (free/pro/agency, Stripe, Supabase auth) — **self-serve only** | Partial |

Therefore the work is **two new subsystems + one orchestration layer + a managed tier**, all reusing
the existing reuse layer. This spec defines them.

### Non-goals (v1)
- No blind 3-way link farm; no autonomous Reddit posting bot (compliance decision — see §4, §5).
- Branded infographics + 50-language content are **deferred to v1.5** (additive to `@advance-labs/blogging`).
- No new brand/product; the offer is a tier inside the existing console.

### Guiding constraints (inherited from the repo)
- **One package, one purpose.** New risky surfaces are isolated in their own packages.
- **Injected I/O.** Every new package is fully testable offline (no network in unit tests), matching
  `@advance-labs/blogging`'s "all I/O is injected" design.
- **Env-gated, ships dormant.** With no new env set, the site behaves exactly as today. New subsystems
  light up only when their credentials/flags are present (matches `COMMERCIAL-LAYER-DESIGN.md`).
- **BYOK.** No third-party keys shipped or billed; request-scoped, never persisted beyond encrypted tokens.

---

## 2. System Overview

```
reuse layer (existing):
  crawler · html-parser · schema-validator · scoring · llm · google-api · storage · backlinks · pdf · ui · types

new packages:
  @advance-labs/link-exchange      consent-based contextual link marketplace (compliant ABC alternative)
  @advance-labs/community          Reddit/forum listening + assisted-reply (compliant Reddit-engine alternative)
  @advance-labs/orchestrator       per-customer autopilot scheduler/queue + approval-inbox model

console (apps/console) additions:
  Managed/Autopilot plan tier · onboarding flow · approval inbox · guarantee-baseline dashboard
```

Data flows one direction: new packages depend only on the reuse layer + `@advance-labs/types`; the console
depends on the new packages. No new package depends on the console.

---

## 3. `@advance-labs/orchestrator` — the autopilot brain

Sequences the per-customer "done-for-you" cadence and routes all outputs to a human approval inbox.

### Responsibilities
- Hold a per-customer **plan profile**: site URL, niche/topics, cadence targets (e.g. N articles/mo,
  M link placements/mo, community presence), connected integrations (CMS, GSC, Reddit).
- On a schedule, enqueue **jobs**: `content.generate`, `link.match`, `community.scan`. Each job runs the
  corresponding existing/new pipeline with injected dependencies and produces a **proposal**.
- Every proposal lands in the **approval inbox** as a typed record (`ContentProposal`, `LinkProposal`,
  `CommunityReplyProposal`) with status `pending → approved → executed | rejected`.
- Approved proposals trigger execution (publish via `@advance-labs/blogging/publish`, record a link placement,
  surface a reply for the human to post). Nothing executes without human approval in v1.

### Shape (injected I/O)
```ts
export interface OrchestratorDeps {
  store: ProposalStore;            // Supabase-backed in console; in-memory in tests
  clock: () => Date;               // injected for deterministic tests
  content: ContentRunner;          // wraps @advance-labs/blogging run()
  link: LinkMatcher;               // wraps @advance-labs/link-exchange
  community: CommunityScanner;     // wraps @advance-labs/community
}
export function runCadence(profile: CustomerProfile, deps: OrchestratorDeps): Promise<JobResult[]>;
```
- Pure scheduling core (`dueJobs(profile, now)`) is unit-tested exhaustively; no network.
- Idempotent: re-running a cadence for the same period does not double-enqueue (dedupe key = customer +
  job-type + period).

---

## 4. `@advance-labs/link-exchange` — compliant contextual link marketplace

The compliant alternative to BLG's blind ABC exchange. The compliance line: links must be **topically
relevant, consented to by both parties, editorially placed in real content, and disclosed** — never
inserted purely to manipulate ranking, never a closed reciprocal farm.

### Model
- Each participant registers a **site profile**: domain, declared topics/niche, an authority signal
  (reuse `@advance-labs/backlinks` graph + any available DR proxy), and **link inventory** — specific existing
  articles where a contextual outbound link could be added with editorial justification.
- A **matching engine** pairs a requester with candidate hosts by topical relevance (reuse
  `@advance-labs/scoring` relevance heuristics + embeddings over declared topics/content) and proposes a placement:
  target URL, host article, suggested anchor + surrounding sentence (drafted by `@advance-labs/llm`), and an
  **editorial rationale** ("this host article on X genuinely benefits from linking to your resource on X").
- **Two-sided approval.** Host must approve the placement in their own content; requester approves the
  anchor/target. Only then is the placement recorded in the ledger as `placed`.
- **Anti-footprint hygiene.** The matcher avoids strict reciprocal A↔B pairs by default (prefers
  relevance-justified chains), caps placements per domain-pair, and records disclosure metadata.

### Shape (injected I/O)
```ts
export interface LinkExchangeDeps {
  store: ExchangeLedger;   // participants, inventory, proposals, placements
  relevance: RelevanceScorer;  // from @advance-labs/scoring + embeddings, injected
  draft: AnchorDrafter;        // @advance-labs/llm, injected
  http: HttpSeam;              // verify a placement is live (reuse backlinks rate-limited http)
}
export function proposePlacements(req: PlacementRequest, deps: LinkExchangeDeps): Promise<LinkProposal[]>;
export function verifyPlacement(placementId: string, deps: LinkExchangeDeps): Promise<PlacementStatus>;
```
- Matching/scoring core is pure and unit-tested; HTTP verification behind the same seam pattern as
  `@advance-labs/backlinks` `rate-limited-http`.

### Risk controls (must ship in v1)
- Relevance threshold gate (reject low-relevance matches outright).
- Mandatory disclosure flag on every placement; per-pair and per-domain rate caps.
- Audit log of who approved what, when. (Detailed in §8.)

---

## 5. `@advance-labs/community` — Reddit/forum listening + assisted-reply

The compliant alternative to BLG's Reddit posting agent. **Listening + drafting, human posts.** No
autonomous posting, no mass automation — both to respect Reddit's API terms and to avoid account bans
that would harm customers.

### Model
- **Listen:** official Reddit OAuth (read scope) polls configured subreddits + keyword queries for
  high-intent threads (questions in the customer's domain). Pluggable provider seam so other communities
  (forums, HN) can be added later.
- **Classify:** `@advance-labs/llm` scores each thread for intent + fit, filters noise, and ranks.
- **Draft:** for top threads, draft a **genuinely helpful, non-promotional** reply grounded in the
  customer's own content (cite their resource only where it actually answers the question). Output flags
  whether a brand mention is even appropriate (many threads → "engage, don't promote").
- **Approve & post (human):** drafts land in the orchestrator approval inbox. The human edits and posts
  from their own authenticated account. The system never posts autonomously in v1.
- **Track:** record which threads were engaged; later cross-reference with `ai-visibility` to see whether
  engaged threads get LLM-cited over time.

### Shape (injected I/O)
```ts
export interface CommunityDeps {
  reddit: RedditReadProvider;  // injected; real client uses official OAuth read
  classify: ThreadClassifier;  // @advance-labs/llm, injected
  draft: ReplyDrafter;         // @advance-labs/llm, injected
  clock: () => Date;
}
export function scanCommunities(cfg: CommunityConfig, deps: CommunityDeps): Promise<CommunityReplyProposal[]>;
```
- All providers injected → unit tests use fixtures, zero network.

### Risk controls (must ship in v1)
- Read-only Reddit access in v1; no write/post capability in the package at all (posting is the human's
  manual action). This makes accidental autonomous posting structurally impossible.
- Per-subreddit rate/relevance gates; "do not engage" classification path for low-fit threads.

---

## 6. Console — Managed / Autopilot tier

Extends `docs/COMMERCIAL-LAYER-DESIGN.md` (do not break its dormant-by-default contract).

- **Plan:** add `managed` to `PlanId` and `PLANS` in `apps/console/src/lib/billing/plans.ts`
  (done-for-you; price is an editable default). Reuses the existing Stripe + entitlements path.
- **Onboarding flow** (`/onboarding`): runs the existing audit + GSC query-gap analysis (reuse
  `@advance-labs/blogging`'s research + `@advance-labs/google-api`) to produce the initial topic clusters + a 30-day
  content calendar — BLG's "business analysis" step, reusing what already exists.
- **Approval inbox** (`/inbox`): lists `pending` proposals (content / link / community) with approve/reject/
  edit actions; approval triggers the orchestrator's execution path. New RLS tables (additive, same
  pattern as `schema-billing.sql`: user reads only their own rows; service role for orchestrator writes).
- **Guarantee baseline** (`/account` addition): captures a visibility/traffic baseline at onboarding
  (reuse `ai-visibility` + GSC) so the 90-day guarantee has an objective measurement. Display delta over time.
- **Dormant-safe:** with no managed/Reddit/Stripe env set, none of this activates; existing free tools
  behave exactly as today (asserted by a test, per the existing convention).

---

## 7. Reuse map (what each new piece leans on)

| New piece | Reuses |
|---|---|
| `@advance-labs/orchestrator` | `@advance-labs/blogging` (content), `@advance-labs/storage` (proposal store), `@advance-labs/types` |
| `@advance-labs/link-exchange` | `@advance-labs/backlinks` (graph + rate-limited http), `@advance-labs/scoring` (relevance), `@advance-labs/llm` (anchor draft), `@advance-labs/storage` |
| `@advance-labs/community` | `@advance-labs/llm` (classify + draft), `@advance-labs/types`; new Reddit read provider |
| Console managed tier | existing commercial layer, `@advance-labs/google-api`, `ai-visibility`, `@advance-labs/blogging` research |

---

## 8. Security & compliance baseline (additive to BUILD-PLAN §7)

- **Link-exchange:** relevance-gate + two-sided consent + disclosure metadata + per-pair/per-domain caps +
  immutable audit log. No placement without recorded approval from both sides.
- **Community:** read-only Reddit in v1; package contains no posting capability; per-subreddit gates;
  PII-safe (store thread ids/urls, not scraped personal data).
- **Reddit OAuth tokens & any CMS tokens:** encrypted at rest via the existing `@advance-labs/storage` `TokenStore`
  (AES-256-GCM), never logged.
- **Orchestrator:** idempotent jobs; all customer-scoped data behind RLS; service-role only for writes.
- **Everything env-gated and dormant** until creds present; a test asserts the no-env baseline is unchanged.

---

## 9. Testing strategy

- Each new package: pure-core unit tests with injected deps + fixtures, **zero network** (matches
  `@advance-labs/blogging`'s `run.test.ts` pattern).
- Orchestrator: deterministic cadence tests via injected `clock`; idempotency test (double-run = no dupes).
- Link-exchange: relevance-gate + cap + disclosure-required tests; placement-verify behind http seam.
- Community: classify/draft/“do-not-engage” path tests via fixtures; assert no posting API exists.
- Console: entitlement tests extended for `managed`; dormant-baseline test (no new env → behaves as today);
  RLS policy tests for new inbox tables.

---

## 10. Open questions (to confirm during/after check-agent review)

1. Pricing of the `managed` tier (BLG is $99 all-in; your self-serve agency is already $99 — managed
   likely sits above, e.g. $199–$499; treat as an editable default).
2. Whether link-exchange participants are limited to your own customers (closed network, BLG-style) or
   can include opted-in external sites (larger, more relevance-diverse, but more moderation).
3. Community providers beyond Reddit in v1 (recommend Reddit-only for v1).

---

## 11. Deliverable after this spec

1. Check-agent review (feasibility / compliance-legal / security / business) — findings folded back here.
2. Implementation **swarm plan** in `BUILD-PLAN.md` phase/ownership style (one agent per package/app,
   verify barriers, dependency-gated phases).
