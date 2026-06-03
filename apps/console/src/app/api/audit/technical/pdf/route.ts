/**
 * POST /api/audit/technical/pdf
 *
 * Streams a PDF of an AuditReport (`application/pdf`). The body may be either:
 *   - `{ report: AuditReport }` — render an already-computed report (the page
 *     posts the report it just received, so no second crawl is needed), or
 *   - `{ url, maxPages? }` — re-run the audit, then render the resulting report.
 *
 * Node runtime: `@aeo/pdf` (react-pdf) is server-only and not edge-safe.
 */
import type { AuditReport } from '@aeo/types';
import { renderAuditReportPdf } from '@aeo/pdf';
import { runAudit } from '@/lib/audit-pipeline';
import { toErrorBody, AuditError } from '@/lib/audit-errors';
import { parseAuditRequest } from '@/lib/audit-validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Minimal structural guard: enough to trust a posted report for rendering. */
function isAuditReport(value: unknown): value is AuditReport {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r['url'] === 'string' &&
    typeof r['generatedAt'] === 'string' &&
    typeof r['score'] === 'object' &&
    r['score'] !== null &&
    Array.isArray(r['topFixes'])
  );
}

async function resolveReport(payload: unknown): Promise<AuditReport> {
  if (typeof payload === 'object' && payload !== null && 'report' in payload) {
    const report = (payload as { report: unknown }).report;
    if (!isAuditReport(report)) {
      throw new AuditError('invalid_request', 'Provided "report" is not a valid AuditReport.', 400);
    }
    return report;
  }
  // Fall back to running a fresh audit from { url, maxPages }.
  const { url, maxPages } = parseAuditRequest(payload);
  return runAudit({ url, maxPages });
}

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { error: { code: 'invalid_request', message: 'Request body must be valid JSON.' } },
      { status: 400 },
    );
  }

  try {
    const report = await resolveReport(payload);
    const bytes = await renderAuditReportPdf(report);
    const filename = pdfFilename(report.url);
    // Copy into a fresh ArrayBuffer so the Response body is a standalone, typed BodyInit.
    const buffer = bytes.slice().buffer;
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const { body, status } = toErrorBody(err);
    return Response.json(body, { status });
  }
}

/** Derive a friendly download filename from the audited URL's hostname. */
function pdfFilename(url: string): string {
  let host = 'site';
  try {
    host = new URL(url).hostname.replace(/^www\./, '') || 'site';
  } catch {
    // keep the default
  }
  const safe = host.replace(/[^a-z0-9.-]/gi, '-');
  return `aeo-audit-${safe}.pdf`;
}
