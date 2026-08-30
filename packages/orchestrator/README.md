# @advance-labs/orchestrator

The spine of the **Autopilot v1** managed layer. It sequences a per-customer "done-for-you" cadence
and routes everything it produces into a human-review **proposal** model — nothing publishes or sends
as a silent side effect.

> Scope (spec §0.7): **content + outreach only**. No marketplace, no Reddit. Those proposal kinds are
> typed in `@advance-labs/types` but produced by no runner here.

## What it does

| Piece | Purpose |
|---|---|
| **Cadence core** (`dueJobs`, `periodOf`, `dedupeKey`) | Pure scheduling. Decides which `JobKind`s are due for a customer in a `YYYY-MM` period. Idempotent on `customerId:jobKind:period`. |
| **`ProposalStore`** | CRUD + list-by-customer/status + **idempotent `createForJob`** keyed on the job dedupe key. In-memory impl for tests; `SupabaseProposalStore` for production. |
| **`ContentRunner`** | Composes `@advance-labs/blogging` sub-agents `research → write → edit`, **stops before publish**, and emits a `ContentProposal` (draft markdown + a 0–1 `confidence`). |
| **`OutreachRunner`** | `@advance-labs/backlinks` discovery + contact extraction over **SSRF-guarded** `@advance-labs/net-guard` fetches → `LinkOutreachProposal`s (always human-gated). |
| **`shouldAutoExecute`** | The graduated-autonomy gate: content above a confidence threshold may auto-publish; outreach **never** auto-executes. |
| **`runCadence`** | Ties it together for one customer/pass; writes proposals; returns `JobResult[]`. |

## Design invariants

- **All I/O injected** — network, clock, storage, LLM, and id generation are passed in. Unit tests run
  with **zero network** and a fake clock. Pure cores contain no `Date.now()` / `Math.random()`.
- **SSRF** — every prospect-page fetch in `OutreachRunner` goes through the injected
  `@advance-labs/net-guard.safeFetch`, never a raw HTTP client.
- **Output safety** — model output is schema-validated (`validateContentPayload`); the outreach send
  target is allowlisted to an address extracted off the prospect page, and the only URL in the pitch is
  the customer's own agreed `siteUrl` — never a model-derived URL.
- **No dependency inversion** — depends only on the reuse layer (`@advance-labs/blogging`, `@advance-labs/backlinks`,
  `@advance-labs/net-guard`, `@advance-labs/storage`) + `@advance-labs/types`. It must **not** import from `apps/console`.

## Usage

```ts
import {
  runCadence,
  InMemoryProposalStore,
  createLiveContentRunner,
  createLiveOutreachRunner,
} from '@advance-labs/orchestrator';

const results = await runCadence(profile, {
  store: getProposalStore(process.env, new InMemoryProposalStore()),
  clock: () => new Date(),
  content: createLiveContentRunner({ googleAccessToken, draftModel, reasoningModel }),
  outreach: createLiveOutreachRunner({ http, fetchDeps }),
});
```

## Supabase table

`SupabaseProposalStore` expects a `proposals` table:

```
id (text, pk), customer_id (text), owner_id (text), kind (text), status (text),
payload (jsonb), dedupe_key (text), created_at (timestamptz),
decided_by (text, null), decided_at (timestamptz, null)
```

Recommended indexes: `(customer_id)`, `(customer_id, status)`, `(dedupe_key)`. RLS: owner reads own
rows; service-role writes (orchestrator + inbox execution). Env: `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, optional `PROPOSALS_TABLE`.
