/**
 * POST /api/audit/technical
 *
 * Body: { url: string, maxPages?: number }
 * Pipeline: crawl -> parseHtml (per page) -> analyzeStructuredData (per page)
 *           -> assemble ScoringContext{ mode: 'full-site' } -> buildAuditReport.
 * Returns the AuditReport as JSON, or a structured error body with a non-2xx status.
 *
 * Runs on the Node runtime (the crawler does network I/O and is not edge-safe). The testable core
 * lives in `@/lib/handle-audit` — Next.js route modules may only export route handlers + config.
 */
import { handleAudit } from '@/lib/handle-audit';
import { auditRateLimiter } from '@/lib/audit-rate-limit';

export const runtime = 'nodejs';
// The audit is request-driven and must never be statically cached.
export const dynamic = 'force-dynamic';

export function POST(request: Request): Promise<Response> {
  return handleAudit(request, auditRateLimiter);
}
