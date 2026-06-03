/**
 * Core technical-audit request handler, kept OUT of the route file so the rate limiter can be
 * injected for tests (no Redis, no shared module state) — Next.js route modules may only export
 * route handlers, so a testable helper has to live here in `lib/`.
 */
import { NextResponse } from 'next/server';
import type { AuditReport } from '@aeo/types';
import { runAudit } from './audit-pipeline.js';
import { toErrorBody } from './audit-errors.js';
import { parseAuditRequest } from './audit-validate.js';
import { clientIp } from './audit-rate-limit.js';
import type { RateLimiter } from './audit-rate-limit.js';

export async function handleAudit(request: Request, limiter: RateLimiter): Promise<Response> {
  const decision = await limiter.check(clientIp(request.headers));
  if (!decision.allowed) {
    return NextResponse.json(
      { error: { code: 'rate_limited', message: 'Too many audits. Please retry shortly.' } },
      // resetSeconds → Retry-After tells the client when the window frees up.
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
