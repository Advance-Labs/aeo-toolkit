# Tool 10 — Backlink Graph (3D) (`apps/backlink-graph`)

**Type:** Next.js (App Router) + WebGL · **Deploy:** Vercel (Node runtime for build, client WebGL canvas)
**Depends on:** `@advance-labs/backlinks` (new), `@advance-labs/crawler`, `@advance-labs/ui`, `@advance-labs/types`, optionally `@advance-labs/llm`

## What it does
The user enters **one URL**. The tool gathers that site's backlinks, mentions, references, and competitor
link sources from open indexes and renders them as an **interactive 3D force-directed graph** — a glowing
"spider web" of websites. The target sits at the center; referring domains, backlinking pages, unlinked
mentions, and competitor sources orbit it, connected by directional strands. Drag to rotate, scroll to
zoom, click a node to inspect it and **expand its own backlinks**, exploring the link universe progressively.

## Architecture (reuse thesis)
The backlink-gathering providers already exist in `apps/backlink-mcp`. **Extract them once** into a shared
`@advance-labs/backlinks` package so both the MCP server (Tool 8) and this graph app consume the same engine — the
MCP tools become thin wrappers over it.

- **New package `@advance-labs/backlinks`**
  - Providers (injectable-fetch, rate-limited, graceful-degrading): DuckDuckGo HTML, CommonCrawl index,
    Wayback CDX, `verifyPageLinks`, contact extraction.
  - `buildBacklinkGraph(rootUrl, opts): Promise<BacklinkGraph>` — runs providers in parallel (bounded +
    rate-limited via the existing `@advance-labs/mcp-core` / `@advance-labs/storage` limiter), normalizes + dedups by
    canonical URL/domain, aggregates to a **domain layer** with **page-level detail on demand**.
- **New app `apps/backlink-graph`** (Next.js)
  - `GET /api/graph/stream` (SSE) streams nodes/edges as discovered, so the web *grows live*.
  - `POST /api/graph` non-streaming fallback returning the full `BacklinkGraph`.
  - `POST /api/graph/expand` fetches a single node's backlinks for progressive exploration.
  - Client page renders with `react-force-graph-3d` (dynamic import, `ssr: false`).

## Types (in `@advance-labs/types` or `@advance-labs/backlinks`)
```ts
type GraphNodeType = 'root' | 'referring-domain' | 'backlink-page' | 'mention' | 'competitor';
interface GraphNode { id: string; type: GraphNodeType; domain: string; url?: string; title?: string;
  authority?: number; mentionType?: 'linked' | 'unlinked'; dofollow?: boolean; firstSeen?: string; }
interface GraphEdge { source: string; target: string; kind: 'backlink' | 'mention' | 'competitor';
  dofollow: boolean; anchorText?: string; }
interface BacklinkGraphStats { referringDomains: number; backlinks: number; dofollowRatio: number;
  topSources: { domain: string; count: number }[]; sampled: true; }
interface BacklinkGraph { root: string; nodes: GraphNode[]; edges: GraphEdge[]; stats: BacklinkGraphStats; }
```

## The 3D scene
| Element | Encoding |
|---------|----------|
| Node size | in-degree / authority (root largest, highlighted/pulsing) |
| Node color | type (referring domain · backlink page · unlinked mention · competitor) |
| Edge | directional **particles** flowing source→target (link direction shown as motion) |
| Edge style | dofollow = bright/solid · nofollow = dim/dashed |
| Clustering | force grouping by domain; optional topic clusters (via `@advance-labs/llm`) |
| Aesthetic | bloom/glow post-processing for the "web" look |

**Interaction:** hover → tooltip (domain, #links, anchor, authority); click → side panel (title, anchor
texts, Wayback first-seen, contacts, outbound links) + **Expand**; filters (dofollow-only, mention type,
min authority, domain search); layout toggles (3D force / radial / clustered); focus/isolate a
neighborhood. Exports: PNG screenshot, graph JSON, backlinks CSV.

## Tech choices
- **3D:** `react-force-graph-3d` (wraps three.js + d3-force-3d) for v1 — physics, WebGL, hover/click,
  animated link particles out of the box. For very large graphs, drop to `three.js` + `three-forcegraph`
  with instancing/LOD + an `EffectComposer` bloom pass.
- **Streaming:** SSE so the graph builds incrementally (compelling "web grows" effect) within a wall-clock budget.
- **SSR:** the WebGL canvas is client-only — dynamic-import with `ssr: false` and lazy-load three.js to keep the bundle lean.

## Honesty / data accuracy
Free sources (DuckDuckGo / CommonCrawl / Wayback) yield a **sample**, not a complete web index like Ahrefs.
The UI labels results "discovered backlinks from open indexes" and exposes a pluggable slot for a paid API
(e.g. Ahrefs free tier) for completeness.

## Build sequence
1. Extract `@advance-labs/backlinks` engine + `buildBacklinkGraph` + graph types (mocked-fetch tests); refactor
   `backlink-mcp` tools to consume it.
2. `apps/backlink-graph`: `/api/graph` returns static graph JSON.
3. Wire `react-force-graph-3d` (dynamic import): nodes/edges + orbit/zoom.
4. Detail panel + filters + node expansion (`/api/graph/expand`).
5. SSE streaming → live graph growth + progress.
6. Visual polish: bloom, directional particles, clustering, root highlight.
7. Exports, empty/error states, sampled-data disclaimer, deploy config + this doc.

**Effort:** ~2–3 weeks; most data plumbing already exists in `backlink-mcp`, so the bulk is the graph
builder + the 3D UI.

**Performance watch-items:** dynamic-import the WebGL canvas (three.js bundle), domain-aggregate by default
+ expand on demand, instancing/LOD beyond ~5k nodes, simulation cooldown for large graphs.
