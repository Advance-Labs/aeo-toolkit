<p align="center"><img src="../../brand/logo.svg" alt="AEO Toolkit" width="280"></p>

# Backlink Graph (3D)

> Enter one URL and explore its **backlink universe** as an interactive 3D force-directed graph — a
> glowing "spider web" of the sites linking to and referencing it.

The target site sits at the center; referring domains, backlinking pages, unlinked mentions, and
competitor sources orbit it, connected by directional strands. Drag to rotate, scroll to zoom, click a
node to inspect it and expand its own backlinks.

Powered by [`@aeo/backlinks`](../../packages/backlinks) (DuckDuckGo + CommonCrawl + Wayback, free
sources) and rendered with [`react-force-graph-3d`](https://github.com/vasturiano/react-force-graph)
(three.js + d3-force-3d). See [`docs/tools/10-backlink-graph.md`](../../docs/tools/10-backlink-graph.md).

## Routes
- `POST /api/graph` — `{ url }` → full `BacklinkGraph` JSON.
- `GET /api/graph/stream?url=` — Server-Sent Events; nodes/edges stream in as discovered.
- `POST /api/graph/expand` — `{ url }` → that node's backlinks (progressive exploration).

## Run
```bash
pnpm --filter @aeo/backlink-graph dev
```

## Honesty note
Free sources yield a **sample**, not a complete web index like Ahrefs — the UI labels results
accordingly and leaves a pluggable slot for a paid backlink API.

## Status
🚧 Active build-out. Deploy on Vercel (root directory = `apps/backlink-graph`, Node runtime).
