/**
 * `renderAuditReportPdf` — server-side entry that turns an `AuditReport` into raw PDF bytes.
 *
 * This is the seam where I/O-ish work (the PDF byte stream) lives. The actual layout is the pure
 * `AuditReportDocument` component, so callers that only need to assert on structure can test the
 * component without spinning up the renderer. Web apps call this from a route handler and stream
 * the bytes back to the browser as an `application/pdf` download.
 */
import { renderToBuffer } from '@react-pdf/renderer';
import type { AuditReport } from '@aeo/types';
import { AuditReportDocument } from './AuditReportDocument.js';

/**
 * Render an audit report to a `Uint8Array` of PDF bytes.
 *
 * @returns A non-empty `Uint8Array` containing a complete PDF document.
 * @throws Propagates any error thrown by the underlying renderer (e.g. unsupported style).
 */
export async function renderAuditReportPdf(report: AuditReport): Promise<Uint8Array> {
  // `renderToBuffer` resolves to a Node Buffer; we copy its bytes into a plain Uint8Array so the
  // public surface stays environment-agnostic (no Node Buffer leaking into consumers' types).
  const buffer = await renderToBuffer(<AuditReportDocument report={report} />);
  return new Uint8Array(buffer);
}
