/**
 * POST /api/managed/decision — a staff/owner decision on a pending proposal.
 *
 * Body: `{ proposalId: string, action: 'approve' | 'reject', rationale?: string }`.
 *
 * Security:
 *  - C2: resolves the session, loads the proposal, and asserts the caller may decide it
 *    (`assertCanDecide`: staff OR owner) BEFORE any service-role mutation. RLS does not protect the
 *    service-role write — this check does.
 *  - H3/H2: approved CONTENT is run through `sanitizeForPublish` (strip HTML, allowlist only the
 *    customer's own href) before it could ever reach a Publisher.
 *  - M4: every decision appends an immutable `proposal_audit` row.
 *  - M1: 404s when the managed tier is dormant.
 */
import { NextResponse } from 'next/server';
import { SupabaseProposalStore, type SupabaseLike } from '@aeo/orchestrator';
import { getUser } from '@/lib/auth/server';
import { managedEnabled } from '@/lib/managed/staff';
import { assertCanDecide } from '@/lib/managed/authz';
import { sanitizeForPublish } from '@/lib/managed/sanitize';
import {
  createServiceClient,
  getCustomerSiteUrl,
  insertAudit,
} from '@/lib/managed/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DecisionBody {
  proposalId?: unknown;
  action?: unknown;
  rationale?: unknown;
}

export async function POST(req: Request): Promise<Response> {
  if (!managedEnabled()) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as DecisionBody;
  const proposalId = typeof body.proposalId === 'string' ? body.proposalId : '';
  const action = body.action === 'approve' || body.action === 'reject' ? body.action : null;
  const rationale = typeof body.rationale === 'string' ? body.rationale : undefined;
  if (!proposalId || action === null) {
    return NextResponse.json({ error: 'proposalId and a valid action are required.' }, { status: 400 });
  }

  const client = createServiceClient();
  if (client === null) {
    return NextResponse.json({ error: 'Managed tier not configured.' }, { status: 503 });
  }

  const store = new SupabaseProposalStore({ client: client as unknown as SupabaseLike });
  const proposal = await store.get(proposalId);
  if (proposal === null) {
    return NextResponse.json({ error: 'Proposal not found.' }, { status: 404 });
  }

  // ── C2: authorize the decision before any mutation ──
  const user = await getUser();
  const authz = assertCanDecide(proposal, user);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.error }, { status: authz.status });
  }
  const actorId = user!.id;
  const decidedAt = new Date().toISOString();

  if (action === 'reject') {
    await store.setStatus(proposalId, { status: 'rejected', decidedBy: actorId, decidedAt });
    await insertAudit(client, { proposalId, ownerId: proposal.ownerId, action: 'rejected', actorId, rationale });
    return NextResponse.json({ ok: true, status: 'rejected' });
  }

  // ── action === 'approve' ──
  await insertAudit(client, { proposalId, ownerId: proposal.ownerId, action: 'approved', actorId, rationale });

  if (proposal.kind === 'content') {
    // H3: sanitize before publish; the only allowed link is the customer's own site.
    const allowedHref = (await getCustomerSiteUrl(client, proposal.customerId)) ?? proposal.payload.slug;
    const safeMarkdown = sanitizeForPublish(proposal.payload.markdown, allowedHref);
    // TODO(lead): publish `safeMarkdown` via @aeo/blogging CmsPublisher once a CMS connection exists.
    // For now the sanitized content is recorded as executed (NoopPublisher semantics).
    void safeMarkdown;
    await store.setStatus(proposalId, { status: 'executed', decidedBy: actorId, decidedAt });
    await insertAudit(client, { proposalId, ownerId: proposal.ownerId, action: 'executed', actorId });
    return NextResponse.json({ ok: true, status: 'executed' });
  }

  // Outreach (and deferred kinds): approval hands the vetted draft to the human to send — not auto-sent.
  await store.setStatus(proposalId, { status: 'approved', decidedBy: actorId, decidedAt });
  return NextResponse.json({ ok: true, status: 'approved' });
}
