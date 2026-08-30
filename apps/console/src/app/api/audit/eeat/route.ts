/**
 * POST /api/audit/eeat
 *
 * Body: `{ "url": string }`. Crawls up to 12 pages, parses each, detects
 * structured data, assembles a `ScoringContext`, and runs `eeatScore` to
 * produce the four-pillar `EeatReport`, returned as JSON.
 *
 * Server-side, Node runtime only (the crawler does outbound HTTP, which is not
 * available on the edge runtime).
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { EeatReport } from '@advance-labs/types';
import { runEeatAudit } from '@/lib/eeat-pipeline';
import { validateAuditBody } from '@/lib/eeat-validate';
import { checkEntitlement } from '@/lib/billing/entitlements';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ErrorResponse {
  error: string;
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<EeatReport | ErrorResponse>> {
  // Entitlement gate (no-op when billing is dormant; returns ok and the site stays open as today).
  const gate = await checkEntitlement(request, 'audit');
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const validated = validateAuditBody(rawBody);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  try {
    const report = await runEeatAudit(validated.url);
    return NextResponse.json(report, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Audit failed.';
    return NextResponse.json(
      { error: `Failed to scan ${validated.url}: ${message}` },
      { status: 502 },
    );
  }
}
