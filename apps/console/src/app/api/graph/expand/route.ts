/**
 * POST /api/graph/expand
 *
 * Body: { url: string }
 * Builds the backlink subgraph rooted at a single node's URL so the client can
 * merge it into the live scene for progressive exploration ("expand this node").
 * Returns the same `BacklinkGraph` shape as `/api/graph` — the client de-dups by
 * node id / canonical url when merging.
 *
 * Same error contract as `/api/graph`: 400 `invalid_request` for a bad body,
 * 502 `build_failed` for an engine failure, never a silent 200.
 *
 * Node runtime (network I/O), force-dynamic (request-driven, never cached).
 */
import { NextResponse } from 'next/server';
import { validateGraphRequest } from '@/lib/graph-validate';
import { buildGraph } from '@/lib/graph-build';
import { checkEntitlement } from '@/lib/billing/entitlements';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  // Entitlement gate (no-op when billing is dormant; returns ok and the site stays open as today).
  const gate = await checkEntitlement(request, 'graph');
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });

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
    const subgraph = await buildGraph(validated.url);
    return NextResponse.json(subgraph, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to expand the node.';
    return NextResponse.json({ error: { code: 'build_failed', message } }, { status: 502 });
  }
}
