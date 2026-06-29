/**
 * POST /api/managed/onboard — create a managed customer profile + capture the guarantee baseline.
 *
 * Body: `{ siteUrl: string, niche?: string, topics?: string[] }`.
 *
 * Requires an active `managed` entitlement (or it returns the gate's 401/402). Seeds the cadence
 * targets from `PLANS.managed` and records a guarantee baseline snapshot for the 90-day SLA. Service-
 * role insert; the row is owned by the session user. M1: closed when managed is dormant.
 */
import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth/server';
import { checkEntitlement } from '@/lib/billing/entitlements';
import { PLANS } from '@/lib/billing/plans';
import { managedEnabled } from '@/lib/managed/staff';
import { createServiceClient } from '@/lib/managed/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface OnboardBody {
  siteUrl?: unknown;
  niche?: unknown;
  topics?: unknown;
}

export async function POST(req: Request): Promise<Response> {
  if (!managedEnabled()) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  // Must hold an active managed entitlement (the gate also enforces auth).
  const gate = await checkEntitlement(req, 'managed');
  if (!gate.ok) {
    return NextResponse.json(gate.body, { status: gate.status });
  }
  const user = await getUser();
  if (user === null) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as OnboardBody;
  const siteUrl = typeof body.siteUrl === 'string' ? body.siteUrl.trim() : '';
  if (!siteUrl) {
    return NextResponse.json({ error: 'siteUrl is required.' }, { status: 400 });
  }
  const niche = typeof body.niche === 'string' ? body.niche : '';
  const topics = Array.isArray(body.topics) ? body.topics.filter((t): t is string => typeof t === 'string') : [];

  const client = createServiceClient();
  if (client === null) {
    return NextResponse.json({ error: 'Managed tier not configured.' }, { status: 503 });
  }

  const limits = PLANS.managed.limits;
  // Guarantee baseline: the objective snapshot the 90-day work-delivered SLA is measured against.
  // TODO(lead): enrich with a live ai-visibility citation-coverage snapshot (src/mcp/ai-visibility).
  const guaranteeBaseline = {
    capturedAt: new Date().toISOString(),
    siteUrl,
    targetPrompts: topics,
    method: 'baseline-v1',
  };

  const { data, error } = await client
    .from('customer_profiles')
    .insert({
      owner_id: user.id,
      site_url: siteUrl,
      niche,
      topics,
      articles_per_month: limits.articlesPerMonth ?? 0,
      outreach_placements_per_month: limits.outreachPlacementsPerMonth ?? 0,
      guarantee_baseline: guaranteeBaseline,
    })
    .select('id')
    .single();

  if (error !== null || data === null) {
    return NextResponse.json({ error: 'Could not create profile.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, customerId: (data as { id: string }).id });
}
