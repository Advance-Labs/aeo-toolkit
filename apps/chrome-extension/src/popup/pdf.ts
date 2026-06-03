/**
 * Client-side PDF report generator using jsPDF (no Node, no server).
 *
 * Renders the score, the prioritized top fixes, and the full check list into a
 * paginated A4 document the user can save or share.
 */
import { jsPDF } from 'jspdf';
import type { AuditPayload } from '../lib/types.js';
import { toCheckRows } from '../lib/audit.js';

const MARGIN = 14;
const LINE = 6;

/** Build and trigger download of a PDF audit report. Returns the filename used. */
export function exportAuditPdf(payload: AuditPayload): string {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = MARGIN;

  const newPageIfNeeded = (needed: number): void => {
    if (y + needed > pageHeight - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  // Header.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('AEO / GEO Audit Report', MARGIN, y);
  y += LINE + 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(payload.pageUrl, MARGIN, y, { maxWidth: pageWidth - MARGIN * 2 });
  y += LINE;
  doc.text(`Generated: ${formatDate(payload.report.generatedAt)}`, MARGIN, y);
  y += LINE + 2;

  // Score block.
  const { score } = payload.report;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.text(`${score.overall}/100`, MARGIN, y + 4);
  doc.setFontSize(16);
  doc.text(`Grade ${score.grade}`, MARGIN + 46, y + 4);
  y += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(
    `Passed ${score.passedCount} · Failed ${score.failedCount} · Critical ${score.criticalCount}`,
    MARGIN,
    y,
  );
  y += LINE + 2;

  // Category breakdown.
  newPageIfNeeded(LINE * 3);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Category scores', MARGIN, y);
  y += LINE;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  for (const category of score.categories) {
    newPageIfNeeded(LINE);
    doc.text(`${category.label}: ${category.score}/100`, MARGIN, y);
    y += LINE;
  }
  y += 2;

  // Top fixes.
  const fixes = payload.report.topFixes;
  if (fixes.length > 0) {
    newPageIfNeeded(LINE * 2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Priority fixes', MARGIN, y);
    y += LINE;
    doc.setFontSize(9);
    fixes.slice(0, 15).forEach((fix, i) => {
      const lines = doc.splitTextToSize(
        `${i + 1}. [${fix.severity}] ${fix.title} — ${fix.recommendation}`,
        pageWidth - MARGIN * 2,
      );
      newPageIfNeeded(lines.length * 5 + 1);
      doc.setFont('helvetica', 'normal');
      doc.text(lines, MARGIN, y);
      y += lines.length * 5 + 1;
    });
    y += 2;
  }

  // Full checklist.
  newPageIfNeeded(LINE * 2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('All checks', MARGIN, y);
  y += LINE;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  for (const row of toCheckRows(payload)) {
    newPageIfNeeded(LINE);
    const mark = row.passed ? '[PASS]' : '[FAIL]';
    const text = `${mark} ${row.title} (${row.category})`;
    const lines = doc.splitTextToSize(text, pageWidth - MARGIN * 2);
    newPageIfNeeded(lines.length * 5);
    doc.text(lines, MARGIN, y);
    y += lines.length * 5;
  }

  const filename = `aeo-audit-${safeHost(payload.pageUrl)}-${Date.now()}.pdf`;
  doc.save(filename);
  return filename;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/[^a-z0-9.-]/gi, '');
  } catch {
    return 'page';
  }
}
