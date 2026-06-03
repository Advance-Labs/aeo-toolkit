/**
 * @aeo/pdf — server-side PDF audit report renderer.
 *
 * Public surface:
 * - {@link AuditReportDocument} — the `@react-pdf/renderer` component (score + grade, category
 *   breakdown, top fixes). Useful for embedding in a larger document or for testing structure.
 * - {@link renderAuditReportPdf} — renders an `AuditReport` to PDF bytes (`Uint8Array`) on the server.
 *
 * The Chrome extension (tool 5) uses jsPDF directly for a local-only export; this package is the
 * server-side path used by the web apps' download endpoints.
 */
export { AuditReportDocument } from './AuditReportDocument.js';
export type { AuditReportDocumentProps } from './AuditReportDocument.js';
export { renderAuditReportPdf } from './render.js';
