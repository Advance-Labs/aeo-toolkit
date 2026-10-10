---
title: ADR-0004 — Three MCP servers, split on the auth seam
description: >-
  Why 31 MCP tools are served as three endpoints rather than one, why the dividing line is authentication rather than subject matter, and the open question about folding the two keyless servers together.
---

- **Status:** Accepted
- **Date:** 2026-10-02
- **Supersedes:** nothing. **Amends:** [ADR-0003](0003-single-vercel-deployment.md), which named
  "the 3 MCP servers" without recording why there are three.

> **This ADR is retroactive.** The split was made in practice during the MCP build and was never
> written down. The reasoning survived only as a code comment in the route handlers and a
> paragraph in `docs/reference/tools.md`, which is why "why don't we just combine them?" has now
> been asked more than once. Recording it is the entire point of this document.

## Context

The suite exposes **31 MCP tools** across three Streamable-HTTP endpoints:

| Server | Endpoint | Tools | Auth |
|---|---|---|---|
| AI Visibility | `/api/mcp/ai-visibility/mcp` | 5 | none |
| Backlink | `/api/mcp/backlink/mcp` | 7 | none |
| Search (Google + Bing) | `/api/mcp/search/mcp` | 19 | Google OAuth, or Google/Bing BYOK |

The recurring question is whether these should be one server. Two facts have to be established
first, because the question is usually asked on a false premise.

**They are not three services.** ADR-0003 consolidated every HTTP deployable into `apps/console`.
These are three Next.js route handlers in one deployment: one build, one Vercel project, one env
set. The usual argument for merging microservices — deploy overhead, duplicated infrastructure,
triple the operational surface — was already paid down by ADR-0003 and does not apply.

**The shared surface is already shared.** All three routes are thin:

| Shared | Where | Lines |
|---|---|---|
| `registerTool`, structured errors, OAuth helpers, rate limiting, transport | `@advance-labs/mcp-core` | 635 |
| Common per-caller rate limiter | `apps/console/src/mcp/shared.ts` | 113 |
| `checkEntitlement(request, 'mcp')` | identical in all four routes | — |

What differs per server is tool logic for genuinely different domains: AI Visibility calls
Perplexity (985 lines), Backlink scrapes DuckDuckGo, Wayback and CommonCrawl (1,091), Search wraps
Google Search Console, GA4 and Bing Webmaster (2,753). Merging the endpoints would not merge any of
that; it would only change how many URLs a client configures.

So the real question is narrow: **should 31 tools be advertised behind one URL or several?**

## Decision

**Keep the servers split, and split them on authentication rather than on subject matter.**

MCP scopes authentication **per server, not per tool**. That single protocol fact decides this.
AI Visibility and Backlink read public information — whether an engine names a company, and who
links to whom — so there is nothing to authenticate. Search reads a user's own Search Console, GA4
and Bing data, which Google will not release without consent.

Merging all three forces a choice between two bad options:

1. **Put all 31 tools behind Google OAuth.** Asking "does ChatGPT mention my company?" would then
   require a Google login. That destroys the keyless servers' value as a zero-friction entry point,
   which is also their lead-generation function: they are the thing someone can try in thirty
   seconds without an account.
2. **Advertise 31 tools where 19 fail at call time unless authenticated.** Clients handle partial
   auth badly, and the first run is a wall of tool-call failures.

This decision is already enforced elsewhere in the codebase and should be read as part of it: the
**root `/.well-known/oauth-*` documents return 404 on purpose**, because advertising OAuth at the
root would drag the two keyless servers into a login they do not need. That 404 is the auth seam
made operational. Removing the split would make it incoherent.

Two further reasons, neither sufficient alone:

- **Context cost.** Every tool definition a server advertises is loaded into the client's context
  on connect. Observed 2026-10-02: a Claude Code session with all three servers configured
  **deferred all 31 tool schemas** rather than loading them, requiring an explicit search to pull
  five. The harness independently judged 31 schemas not worth the budget. One server makes that
  worse for every client, including those with no deferral mechanism.
- **Blast radius.** One handler means one failure domain and one rate-limit scope. Today a
  Perplexity outage cannot take down the backlink tools.

## Consequences

- Three `claude mcp add` commands instead of one, and three entries in every client config. This is
  the real cost and it is accepted.
- A user who connects only one server may never discover the others. Mitigated by the connection
  page at `/mcp` — which, note, **404'd on `advancelabs.dev` until 2026-10-02** because only
  `/tools/*` was proxied from the marketing domain. Onboarding friction attributed to the split was
  partly this bug.
- The keyless servers stay usable with no account, which is what makes them a viable top of funnel.
- Adding a fourth domain later means a fourth endpoint, and the auth question should be asked first:
  anything keyless could join the keyless group rather than earn its own URL.

## The open question: fold the two keyless servers into one?

The auth seam splits the set **12 / 19**, not 5 / 7 / 19. AI Visibility and Backlink have **no auth
divider between them** — both are keyless, and both take their optional third-party keys
(Perplexity, LLM) as *request-scoped tool arguments*, never as server credentials. Nothing
structural keeps them apart; they are separate because they were built separately.

```
today        ai-visibility (5)   backlink (7)      search (19)
auth seam    └───────── keyless, 12 ────────┘      └── authed ──┘
```

Folding them would halve connection friction with no auth downside — the only merge available that
costs nothing on this axis. What it trades is the context argument above (12 tool schemas in one
connect instead of 5 or 7) and the blast-radius argument (a Perplexity outage would then sit in the
same handler as the scrapers).

**Not decided here.** Tracked as a spike; it needs a measurement of real client context cost at 12
tools, not an opinion. Do not fold it in on aesthetic grounds.

## Alternatives considered

- **One server, all 31 tools, OAuth for everything.** Rejected: see Decision, option 1. It converts
  a keyless demo into a gated product and gives up the funnel.
- **One server, tools that 401 individually.** Rejected: MCP has no per-tool auth, and emulating it
  produces a client experience of advertised tools that fail on call.
- **One server per subject area, ignoring auth.** This is what the current shape looks like from
  outside, and it is not the reason. Subject matter is a weak organising principle here because the
  domains are not what clients connect for — capability is. Auth is the line that actually changes
  what a client can do.
