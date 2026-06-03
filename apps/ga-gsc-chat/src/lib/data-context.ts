/**
 * Pure transforms that compress GA4 + Search Console reports into a compact, token-efficient text
 * context the LLM can ground its answer in. No network, no I/O — fully unit-testable.
 *
 * The context is deliberately tabular and bounded (top-N rows) so the prompt stays small and the
 * model is anchored to real numbers rather than guessing.
 */
import type { Ga4Report, Ga4Row, GscReport, GscRow } from '@aeo/types';

/** How many rows of each table to surface to the model. Keeps the prompt compact. */
export const DEFAULT_TOP_N = 15;

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Format a GSC CTR (0..1 fraction from the API) as a percentage string. */
function pct(fraction: number): string {
  return `${round(fraction * 100, 2)}%`;
}

/**
 * Render the top GSC rows as a fixed-width-ish text table. Each row's `keys` align to the requested
 * dimensions (e.g. `query`, `page`). Sorted by impressions desc so the highest-leverage rows lead.
 */
export function formatGscTable(
  report: GscReport,
  dimensions: readonly string[],
  topN: number = DEFAULT_TOP_N,
): string {
  if (report.rows.length === 0) {
    return 'No Search Console rows for the selected range.';
  }

  const sorted: GscRow[] = [...report.rows].sort((a, b) => b.impressions - a.impressions);
  const limited = sorted.slice(0, topN);

  const header = [...dimensions, 'clicks', 'impressions', 'ctr', 'avgPosition'].join(' | ');
  const lines = limited.map((row) => {
    const keyCells = dimensions.map((_, i) => row.keys[i] ?? '');
    return [
      ...keyCells,
      String(row.clicks),
      String(row.impressions),
      pct(row.ctr),
      String(round(row.position, 1)),
    ].join(' | ');
  });

  return [header, ...lines].join('\n');
}

/**
 * Render the top GA4 rows as a text table keyed by the report's own dimension/metric names. GA4
 * rows already carry named `dimensions`/`metrics` records, so we discover columns from the first
 * row and keep ordering stable.
 */
export function formatGa4Table(report: Ga4Report, topN: number = DEFAULT_TOP_N): string {
  if (report.rows.length === 0) {
    return 'No GA4 rows for the selected range.';
  }

  const first: Ga4Row | undefined = report.rows[0];
  if (first === undefined) {
    return 'No GA4 rows for the selected range.';
  }

  const dimensionNames = Object.keys(first.dimensions);
  const metricNames = Object.keys(first.metrics);
  const limited = report.rows.slice(0, topN);

  const header = [...dimensionNames, ...metricNames].join(' | ');
  const lines = limited.map((row) => {
    const dimCells = dimensionNames.map((name) => row.dimensions[name] ?? '');
    const metricCells = metricNames.map((name) => {
      const value = row.metrics[name];
      return value === undefined ? '0' : String(round(value, 2));
    });
    return [...dimCells, ...metricCells].join(' | ');
  });

  return [header, ...lines].join('\n');
}

export interface DataContextInput {
  propertyId: string;
  siteUrl: string;
  startDate: string;
  endDate: string;
  ga4?: Ga4Report;
  gsc?: GscReport;
  gscDimensions: readonly string[];
  topN?: number;
}

/**
 * Build the full grounding context block. Includes the date window and both tables when available.
 * The LLM is instructed (in the system prompt) to answer ONLY from this block.
 */
export function buildDataContext(input: DataContextInput): string {
  const topN = input.topN ?? DEFAULT_TOP_N;
  const parts: string[] = [
    `Date range: ${input.startDate} to ${input.endDate}`,
    `GA4 property: ${input.propertyId}`,
    `Search Console site: ${input.siteUrl}`,
    '',
    '## Google Search Console (top by impressions)',
    input.gsc
      ? formatGscTable(input.gsc, input.gscDimensions, topN)
      : 'Search Console data unavailable.',
    '',
    '## Google Analytics 4',
    input.ga4 ? formatGa4Table(input.ga4, topN) : 'GA4 data unavailable.',
  ];
  return parts.join('\n');
}
