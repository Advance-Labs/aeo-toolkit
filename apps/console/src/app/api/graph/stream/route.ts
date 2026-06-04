/**
 * GET /api/graph/stream?url=<site>
 *
 * Server-Sent Events stream of a backlink graph, assembled then replayed
 * incrementally so the client can animate the "web growing": the full graph is
 * built once (the free sources don't expose a true streaming API), then emitted
 * in stages —
 *
 *   event: root   → the root node (the centre of the web)
 *   event: nodes  → batches of nodes; referring-domain nodes first, then page
 *                   nodes in small chunks (domains anchor before their pages)
 *   event: edges  → batches of edges
 *   event: stats  → the aggregate BacklinkGraphStats (+ warnings, when present)
 *   event: done   → terminal marker; the stream then closes
 *
 * Each frame is `event: <name>\ndata: <json>\n\n`. A small await between batches
 * paces the growth effect. If the build throws, a single `event: error` frame is
 * emitted and the stream closes — never a half-open hang.
 *
 * Validation failures answer with a normal JSON 400 (no stream is opened).
 * Node runtime (the engine does network I/O), force-dynamic (never cached).
 */
import { NextResponse } from 'next/server';
import type { BacklinkGraph, GraphEdge, GraphNode } from '@aeo/backlinks';
import { validateGraphRequest } from '@/lib/graph-validate';
import { buildGraph } from '@/lib/graph-build';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Free sources run sequentially and Wayback/CommonCrawl can be slow from serverless IPs
// (each up to the 20s client timeout), so allow headroom above any short default.
export const maxDuration = 60;

/** Nodes/edges emitted per batch — small enough that the web visibly grows. */
const BATCH_SIZE = 8;
/** Pause (ms) between batches to pace the growth animation. */
const BATCH_DELAY_MS = 60;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Format one SSE frame: `event: <name>\ndata: <json>\n\n`. */
function frame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Split an array into fixed-size chunks (the last chunk may be smaller). */
function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url).searchParams.get('url');
  const validated = validateGraphRequest({ url });
  if (!validated.ok) {
    return NextResponse.json(
      { error: { code: 'invalid_request', message: validated.error } },
      { status: 400 },
    );
  }
  const rootUrl = validated.url;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller): Promise<void> {
      const send = (event: string, data: unknown): void => {
        controller.enqueue(encoder.encode(frame(event, data)));
      };

      let graph: BacklinkGraph;
      try {
        graph = await buildGraph(rootUrl);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to build the backlink graph.';
        send('error', { code: 'build_failed', message });
        controller.close();
        return;
      }

      try {
        // 1) The root node — the centre the rest of the web orbits.
        send('root', graph.root);

        // 2) Order non-root nodes so referring domains anchor before their pages:
        //    a page edge's source domain should already be in the scene.
        const others = graph.nodes.filter((n) => n.id !== graph.root.id);
        const domains: GraphNode[] = others.filter((n) => n.type === 'referring-domain');
        const pages: GraphNode[] = others.filter((n) => n.type !== 'referring-domain');

        for (const batch of chunk(domains, BATCH_SIZE)) {
          send('nodes', batch);
          await delay(BATCH_DELAY_MS);
        }
        for (const batch of chunk(pages, BATCH_SIZE)) {
          send('nodes', batch);
          await delay(BATCH_DELAY_MS);
        }

        // 3) Edges, in batches, after their endpoints have been emitted.
        const edges: GraphEdge[] = graph.edges;
        for (const batch of chunk(edges, BATCH_SIZE)) {
          send('edges', batch);
          await delay(BATCH_DELAY_MS);
        }

        // 4) Aggregate stats (carry warnings through when the engine degraded).
        send('stats', { stats: graph.stats, warnings: graph.warnings ?? [] });

        // 5) Terminal marker.
        send('done', { ok: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Stream interrupted.';
        send('error', { code: 'stream_failed', message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
