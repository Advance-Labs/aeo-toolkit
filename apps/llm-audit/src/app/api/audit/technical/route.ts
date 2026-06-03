/**
 * POST /api/audit/technical
 *
 * Body: { url: string, maxPages?: number }
 * Pipeline: crawl -> parseHtml (per page) -> analyzeStructuredData (per page)
 *           -> assemble ScoringContext{ mode: 'full-site' } -> buildAuditReport.
 * Returns the AuditReport as JSON, or a structured error body with a non-2xx status.
 *
 * Runs on the Node runtime (the crawler does network I/O and is not edge-safe).
 */
import { NextResponse } from 'next/server';
import type { AuditReport } from '@aeo/types';
import { runAudit } from '../../../../lib/audit-pipeline.js';
import { toErrorBody } from '../../../../lib/errors.js';
import { parseAuditRequest } from '../../../../lib/validate.js';
import { auditRateLimiter, clientIp } from '../../../../lib/rate-limit.js';

export const runtime = 'nodejs';
// The audit is request-driven and must never be statically cached.
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  // STUB: per-IP rate limiting is in-memory / single-instance (see lib/rate-limit.ts).
  const decision = auditRateLimiter.check(clientIp(request.headers));
  if (!decision.allowed) {
    return NextResponse.json(
      { error: { code: 'rate_limited', message: 'Too many audits. Please retry shortly.' } },
      { status: 429, headers: { 'Retry-After': String(decision.resetSeconds) } },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'invalid_request', message: 'Request body must be valid JSON.' } },
      { status: 400 },
    );
  }

  try {
    const { url, maxPages } = parseAuditRequest(payload);
    const report: AuditReport = await runAudit({ url, maxPages });
    return NextResponse.json(report, { status: 200 });
  } catch (err) {
    const { body, status } = toErrorBody(err);
    return NextResponse.json(body, { status });
  }
}
