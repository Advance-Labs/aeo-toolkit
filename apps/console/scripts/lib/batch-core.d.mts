/**
 * Ambient types for batch-core.mjs — the runner's pure helpers are plain JS (so `node` can execute
 * the script directly), but the vitest suite in src/ imports them and type-checks under tsc. This
 * declaration gives those imports real types instead of suppressing the resolution error.
 */
export const CSV_COLUMNS: readonly ["url", "score", "grade", "pages", "failed", "critical", "topFix"];

export function normalizeUrl(input: unknown): string | null;
export function parseTargets(text: string): string[];
export function slugify(url: string): string;

export interface SummaryRow {
  url: string;
  score: number | "";
  grade: string;
  pages: number | "";
  failed: number | "";
  critical: number | "";
  topFix: string;
}

export function topFix(report: unknown): { severity: string; title: string; weight: number } | undefined;
export function summaryRow(url: string, report: unknown): SummaryRow;
export function toCsv(rows: SummaryRow[]): string;
