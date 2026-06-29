# Autopilot — Managed Layer Design (BLG-equivalent)

> Spec v1.0 · 2026-06-29 · Owner: Advance Labs
> Adapts the BabyLoveGrowth (BLG) "done-for-you organic growth" model onto the existing
> `aeo-toolkit` monorepo. Decisions locked with the user: (1) **compliant alternatives** to BLG's
> ToS-risky features, (2) **add a done-for-you "Managed/Autopilot" tier** on top of the existing
> self-serve toolkit, (3) deliverable is an **implementation swarm plan** in the `BUILD-PLAN.md` style.

---

## 1. Goal & Framing

BLG bundles content generation, a backlink-exchange network, technical GEO audits, a Reddit
visibility engine, and LLM-visibility tracking into a single $99/mo done-for-you subscription.

A gap analysis against this repo shows **~80% already exists**:

| BLG service | Existing equivalent in repo | Status |
|---|---|---|
| SEO/LLM content (30/mo, CMS publish) | `@aeo/blogging` (strategy→research→writer→editor→dedup→scheduler→monitor→self-correct + `publish/`) | Built |
| Technical GEO audit | `@aeo/scoring`, `apps/llm-audit`, `apps/console` | Built |
| LLM-visibility tracking | `ai-visibility` MCP (`check_ai_visibility`, `get_visibility_report`), `docs/VISIBILITY-TRACKING.md` | Built |
| Automated backlinks | `@aeo/backlinks` — **discovery/outreach** (find prospects, contacts, outreach), NOT an exchange network | Partial |
| Reddit visibility engine | — | Missing |
| $99 done-for-you offer | `docs/COMMERCIAL-LAYER-DESIGN.md` (free/pro/agency, Stripe, Supabase auth) — **self-serve only** | Partial |

Therefore the work is **two new subsystems + one orchestration layer + a managed tier**, all reusing
the existing reuse layer. This spec defines them.

### Non-goals (v1)
- No blind 3-way link farm; no autonomous Reddit posting bot (compliance decision — see §4, §5).
- Branded infographics + 50-language content are **deferred to v1.5** (additive to `@aeo/blogging`).
- No new brand/product; the offer is a tier inside the existing console.

### Guiding constraints (inherited from the repo)
- **One package, one purpose.** New risky surfaces are isolated in their own packages.
- **Injected I/O.** Every new package is fully testable offline (no network in unit tests), matching
  `@aeo/blogging`'s "all I/O is injected" design.
- **Env-gated, ships dormant.** With no new env set, the site behaves exactly as today. New subsystems
  light up only when their credentials/flags are present (matches `COMMERCIAL-LAYER-DESIGN.md`).
- **BYOK.** No third-party keys shipped or billed; request-scoped, never persisted beyond encrypted tokens.

---

## 2. System Overview

```
reuse layer (existing):
  crawler · html-parser · schema-validator · scoring · llm · google-api · storage · backlinks · pdf · ui · types

new packages:
  @aeo/link-exchange      consent-based contextual link marketplace (compliant ABC alternative)
  @aeo/community          Reddit/forum listening + assisted-reply (compliant Reddit-engine alternative)
  @aeo/orchestrator       per-customer autopilot scheduler/queue + approval-inbox model

console (apps/console) additions:
  Managed/Autopilot plan tier · onboarding flow · approval inbox · guarantee-baseline dashboard
```

Data flows one direction: new packages depend only on the reuse layer + `@aeo/types`; the console
depends on the new packages. No new package depends on the console.

---

## 3. `@aeo/orchestrator` — the autopilot brain

Sequences the per-customer "done-for-you" cadence and routes all outputs to a human approval inbox.

### Responsibilities
- Hold a per-customer **plan profile**: site URL, niche/topics, cadence targets (e.g. N articles/mo,
  M link placements/mo, community presence), connected integrations (CMS, GSC, Reddit).
- On a schedule, enqueue **jobs**: `content.generate`, `link.match`, `community.scan`. Each job runs the
  corresponding existing/new pipeline with injected dependencies and produces a **proposal**.
- Every proposal lands in the **approval inbox** as a typed record (`ContentProposal`, `LinkProposal`,
  `CommunityReplyProposal`) with status `pending → approved → executed | rejected`.
- Approved proposals trigger execution (publish via `@aeo/blogging/publish`, record a link placement,
  surface a reply for the human to post). Nothing executes without human approval in v1.

### Shape (injected I/O)
```ts
export interface OrchestratorDeps {
  store: ProposalStore;            // Supabase-backed in console; in-memory in tests
  clock: () => Date;               // injected for deterministic tests
  content: ContentRunner;          // wraps @aeo/blogging run()
  link: LinkMatcher;               // wraps @aeo/link-exchange
  community: CommunityScanner;     // wraps @aeo/community
}
export function runCadence(profile: CustomerProfile, deps: OrchestratorDeps): Promise<JobResult[]>;
```
- Pure scheduling core (`dueJobs(profile, now)`) is unit-tested exhaustively; no network.
- Idempotent: re-running a cadence for the same period does not double-enqueue (dedupe key = customer +
  job-type + period).

---

## 4. `@aeo/link-exchange` — compliant contextual link marketplace

The compliant alternative to BLG's blind ABC exchange. The compliance line: links must be **topically
relevant, consented to by both parties, editorially placed in real content, and disclosed** — never
inserted purely to manipulate ranking, never a closed reciprocal farm.

### Model
- Each participant registers a **site profile**: domain, declared topics/niche, an authority signal
  (reuse `@aeo/backlinks` graph + any available DR proxy), and **link inventory** — specific existing
  articles where a contextual outbound link could be added with editorial justification.
- A **matching engine** pairs a requester with candidate hosts by topical relevance (reuse
  `@aeo/scoring` relevance heuristics + embeddings over declared topics/content) and proposes a placement:
  target URL, host article, suggested anchor + surrounding sentence (drafted by `@aeo/llm`), and an
  **editorial rationale** ("this host article on X genuinely benefits from linking to your resource on X").
- **Two-sided approval.** Host must approve the placement in their own content; requester approves the
  anchor/target. Only then is the placement recorded in the ledger as `placed`.
- **Anti-footprint hygiene.** The matcher avoids strict reciprocal A↔B pairs by default (prefers
  relevance-justified chains), caps placements per domain-pair, and records disclosure metadata.

### Shape (injected I/O)
```ts
export interface LinkExchangeDeps {
  store: ExchangeLedger;   // participants, inventory, proposals, placements
  relevance: RelevanceScorer;  // from @aeo/scoring + embeddings, injected
  draft: AnchorDrafter;        // @aeo/llm, injected
  http: HttpSeam;              // verify a placement is live (reuse backlinks rate-limited http)
}
export function proposePlacements(req: PlacementRequest, deps: LinkExchangeDeps): Promise<LinkProposal[]>;
export function verifyPlacement(placementId: string, deps: LinkExchangeDeps): Promise<PlacementStatus>;
```
- Matching/scoring core is pure and unit-tested; HTTP verification behind the same seam pattern as
  `@aeo/backlinks` `rate-limited-http`.

### Risk controls (must ship in v1)
- Relevance threshold gate (reject low-relevance matches outright).
- Mandatory disclosure flag on every placement; per-pair and per-domain rate caps.
- Audit log of who approved what, when. (Detailed in §8.)

---

## 5. `@aeo/community` — Reddit/forum listening + assisted-reply

The compliant alternative to BLG's Reddit posting agent. **Listening + drafting, human posts.** No
autonomous posting, no mass automation — both to respect Reddit's API terms and to avoid account bans
that would harm customers.

### Model
- **Listen:** official Reddit OAuth (read scope) polls configured subreddits + keyword queries for
  high-intent threads (questions in the customer's domain). Pluggable provider seam so other communities
  (forums, HN) can be added later.
- **Classify:** `@aeo/llm` scores each thread for intent + fit, filters noise, and ranks.
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
  classify: ThreadClassifier;  // @aeo/llm, injected
  draft: ReplyDrafter;         // @aeo/llm, injected
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
  `@aeo/blogging`'s research + `@aeo/google-api`) to produce the initial topic clusters + a 30-day
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
| `@aeo/orchestrator` | `@aeo/blogging` (content), `@aeo/storage` (proposal store), `@aeo/types` |
| `@aeo/link-exchange` | `@aeo/backlinks` (graph + rate-limited http), `@aeo/scoring` (relevance), `@aeo/llm` (anchor draft), `@aeo/storage` |
| `@aeo/community` | `@aeo/llm` (classify + draft), `@aeo/types`; new Reddit read provider |
| Console managed tier | existing commercial layer, `@aeo/google-api`, `ai-visibility`, `@aeo/blogging` research |

---

## 8. Security & compliance baseline (additive to BUILD-PLAN §7)

- **Link-exchange:** relevance-gate + two-sided consent + disclosure metadata + per-pair/per-domain caps +
  immutable audit log. No placement without recorded approval from both sides.
- **Community:** read-only Reddit in v1; package contains no posting capability; per-subreddit gates;
  PII-safe (store thread ids/urls, not scraped personal data).
- **Reddit OAuth tokens & any CMS tokens:** encrypted at rest via the existing `@aeo/storage` `TokenStore`
  (AES-256-GCM), never logged.
- **Orchestrator:** idempotent jobs; all customer-scoped data behind RLS; service-role only for writes.
- **Everything env-gated and dormant** until creds present; a test asserts the no-env baseline is unchanged.

---

## 9. Testing strategy

- Each new package: pure-core unit tests with injected deps + fixtures, **zero network** (matches
  `@aeo/blogging`'s `run.test.ts` pattern).
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
