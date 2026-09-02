# Archive — historical documents

Nothing in this directory describes the repository as it exists today. These are **planning and
build-time artifacts**, kept because they record *why* the toolkit is shaped the way it is. They were
accurate when written and went stale the moment the work shipped.

**Do not follow instructions in these files.** For current documentation see [`../`](../).

## Why these were archived

The suite was originally built as nine independently-deployable apps. [ADR-0003](../adr/0003-single-vercel-deployment.md)
consolidated every HTTP deployable into a single Next.js app (`apps/console`) and **deleted the
standalone apps**. Every document below predates that consolidation, or describes a build phase that
has since completed.

| Document | What it was | Superseded by |
|---|---|---|
| [`BUILD-PLAN.md`](BUILD-PLAN.md) | The original 9-app build plan and agent-swarm phasing | [`../ARCHITECTURE.md`](../ARCHITECTURE.md), [`../reference/packages.md`](../reference/packages.md) |
| [`tools/`](tools/) | Per-tool specs, each headed with a now-deleted `apps/<tool>` path | [`../reference/tools.md`](../reference/tools.md) |
| [`COMMERCIAL-LAYER-DESIGN.md`](COMMERCIAL-LAYER-DESIGN.md) | Design contract for the auth/billing/MCP-page workstream | [`../ACTIVATION.md`](../ACTIVATION.md) |
| [`AUTOPILOT-GO-LIVE.md`](AUTOPILOT-GO-LIVE.md) | One-time go-live runbook for the managed tier | [`../ACTIVATION.md`](../ACTIVATION.md) |
| [`CONVENTIONS-autopilot.md`](CONVENTIONS-autopilot.md) | Security invariants binding on the Autopilot build agents | [`../CONVENTIONS.md`](../CONVENTIONS.md) § Security invariants |
| [`specs/`](specs/) | Managed-layer design spec + swarm execution plan | — (historical only) |

> `AUTOPILOT-GO-LIVE.md` contains a production Stripe price id and a Supabase project ref. These are
> identifiers, not secrets, but treat them as stale: verify against the live dashboards before reuse.
