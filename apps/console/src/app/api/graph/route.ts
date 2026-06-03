/**
 * POST /api/graph
 *
 * Body: { url: string }
 * Pipeline: validate → buildGraph (engine over free sources) → BacklinkGraph JSON.
 *
 * Non-streaming fallback to the SSE endpoint: returns the full graph at once.
 * Always answers with a structured body and a meaningful status — a bad request
 * is a 400 (`invalid_request`), an engine failure is a 502 (`build_failed`); we
 * never silently return a 200 on error.
 *
 * Runs on the Node runtime (the engine does network I/O and is not edge-safe) and
 * is force-dynamic (request-driven; must never be statically cached).
 */
import { NextResponse } from 'next/server';
import { validateGraphRequest } from '@/lib/graph-validate';
import { buildGraph } from '@/lib/graph-build';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'invalid_request', message: 'Request body must be valid JSON.' } },
      { status: 400 },
    );
  }

  const validated = validateGraphRequest(payload);
  if (!validated.ok) {
    return NextResponse.json(
      { error: { code: 'invalid_request', message: validated.error } },
      { status: 400 },
    );
  }

  try {
    const graph = await buildGraph(validated.url);
    return NextResponse.json(graph, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to build the backlink graph.';
    return NextResponse.json({ error: { code: 'build_failed', message } }, { status: 502 });
  }
}
