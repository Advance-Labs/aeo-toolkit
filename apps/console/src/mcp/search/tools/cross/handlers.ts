/**
 * Cross-engine tool handlers — the reason Google and Bing share one server.
 *
 * Both engines are fetched with `Promise.allSettled`: a partial answer that names
 * its gap beats no answer, and it beats a complete-looking answer with a zeroed
 * half. Every failure path lands in `coverage`, never in the numbers.
 */
import type { ToolResult } from '@advance-labs/mcp-core';
import { errorMessage, McpToolError } from '@advance-labs/mcp-core';

import { bingFor, gscFor, type ToolContext } from '../context.js';
import { jsonResult } from '../gsc/format.js';
import {
  classifyDivergence,
  DIVERGENCE_MEANING,
  fractionalDelta,
  type DivergenceClass,
} from './divergence.js';
import {
  bucketBingQueriesByDate,
  buildCoverage,
  mergeEngineRows,
  normalizeBingQueries,
  normalizeGscRows,
  type EngineRow,
} from './normalize.js';
import type { CompareEnginesInput, EngineDivergenceInput } from './schemas.js';

/** Fetch both engines' query rows, never throwing when one side fails. */
export async function fetchBothEngines(
  ctx: ToolContext,
  input: CompareEnginesInput,
): Promise<{
  google: { rows: EngineRow[] | null; error: string | null };
  bing: { rows: EngineRow[] | null; error: string | null };
}> {
  const bingSite = input.bingSiteUrl ?? input.siteUrl;

  const [googleResult, bingResult] = await Promise.allSettled([
    (async (): Promise<EngineRow[]> => {
      const gsc = await gscFor(ctx);
      const response = await gsc.query({
        siteUrl: input.siteUrl,
        startDate: input.startDate,
        endDate: input.endDate,
        dimensions: ['query'],
        rowLimit: input.limit,
      });
      return normalizeGscRows(response.rows);
    })(),
    (async (): Promise<EngineRow[]> => {
      const bing = await bingFor(ctx);
      return normalizeBingQueries(await bing.getQueryStats(bingSite));
    })(),
  ]);

  return {
    google:
      googleResult.status === 'fulfilled'
        ? { rows: googleResult.value, error: null }
        : { rows: null, error: errorMessage(googleResult.reason) },
    bing:
      bingResult.status === 'fulfilled'
        ? { rows: bingResult.value, error: null }
        : { rows: null, error: errorMessage(bingResult.reason) },
  };
}

/** `compare_engines(...)` — both engines side by side, with an explicit coverage block. */
export async function compareEngines(
  ctx: ToolContext,
  input: CompareEnginesInput,
): Promise<ToolResult> {
  const sides = await fetchBothEngines(ctx, input);
  const coverage = buildCoverage(sides);
  const merged = mergeEngineRows(sides.google.rows, sides.bing.rows);

  // Combined clicks across whichever engines actually answered for this key — a
  // missing engine contributes nothing to the sort key, it is never scored as a
  // zero-click engine. Sorted DESCENDING before slicing so a high-traffic
  // Bing-only row cannot be silently dropped by insertion order while a
  // low-traffic Google row survives merely for coming first.
  const combinedClicks = (row: (typeof merged)[number]): number =>
    (row.google?.clicks ?? 0) + (row.bing?.clicks ?? 0);
  const sorted = [...merged].sort((a, b) => combinedClicks(b) - combinedClicks(a));

  // Computed from the FULL merged set, before truncation — the summary must
  // describe the data, not the slice.
  const bothTotal = sorted.filter((row) => row.google !== null && row.bing !== null).length;
  const rows = sorted.slice(0, input.limit);

  const summary =
    `${rows.length} of ${sorted.length} merged queries for ${input.siteUrl}, sorted by ` +
    `combined clicks descending ` +
    `(Google ${input.startDate}..${input.endDate}; Bing: unwindowed API aggregate); ` +
    `${bothTotal} of ${sorted.length} present on both engines. ` +
    `Google: ${coverage.google.available ? `${coverage.google.rowCount} rows` : `unavailable (${coverage.google.reason ?? ''})`}. ` +
    `Bing: ${coverage.bing.available ? `${coverage.bing.rowCount} rows` : `unavailable (${coverage.bing.reason ?? ''})`}.`;

  return jsonResult(summary, { siteUrl: input.siteUrl, coverage, rows });
}

/** Inclusive day span of a `YYYY-MM-DD` date range. */
function daySpan(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86_400_000) + 1;
}

/** Split a date range into a baseline half and a current half. */
function halves(startDate: string, endDate: string): {
  baseline: { startDate: string; endDate: string };
  current: { startDate: string; endDate: string };
} {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  const mid = new Date(start + Math.floor((end - start) / 2));
  const midDate = mid.toISOString().slice(0, 10);
  const dayAfterMid = new Date(mid.getTime() + 86_400_000).toISOString().slice(0, 10);
  return {
    baseline: { startDate, endDate: midDate },
    current: { startDate: dayAfterMid, endDate },
  };
}

/**
 * `engine_divergence(...)` — where the two engines disagree, and what that means.
 *
 * Splits the range into a baseline half and a current half, then classifies every
 * key. Rows classified `insufficient_data` are counted but not listed: they are the
 * majority of any long tail, and listing them buries the real findings.
 *
 * THE TWO ENGINES ARE WINDOWED DIFFERENTLY, on purpose:
 *
 *  - Google is fetched TWICE, once per half. GSC accepts a date range, so each
 *    half is a real server-side query.
 *  - Bing is fetched ONCE, unwindowed, then bucketed locally by each row's own
 *    `date`. `GetQueryStats(siteUrl)` accepts no date parameter, so fetching it
 *    twice would return the identical aggregate both times and make `bingDelta`
 *    identically zero — which would render `broad` and `bing_specific` structurally
 *    unreachable and misreport every Google decline as `google_specific`. Bing does
 *    return one row per (query x date) (verified live 2026-09-09,
 *    `maxRowsForOneQuery=3` across `distinctDates=6`), which is what makes the local
 *    bucketing sound.
 *
 * NO ZERO-FILL. A half is only comparable when its engine actually answered AND
 * supplied dated rows. When it did not, that half's clicks are `null`, the delta is
 * `null`, and `classifyDivergence` returns `insufficient_data` — never a confident
 * `bing_specific` manufactured out of an API error. Within an available half a key
 * that is genuinely absent IS zero clicks, which is a real measurement and is
 * treated as one. The difference between "we could not ask" and "the answer was
 * none" is the whole point of this function's coverage handling.
 */
export async function engineDivergence(
  ctx: ToolContext,
  input: EngineDivergenceInput,
): Promise<ToolResult> {
  const span = daySpan(input.startDate, input.endDate);
  if (span < 2) {
    throw new McpToolError(
      `engine_divergence needs at least a 2-day range because it compares the first half ` +
        `against the second; received ${input.startDate}..${input.endDate} (${span} day` +
        `${span === 1 ? '' : 's'}).`,
      'engine_divergence_range_too_short',
    );
  }

  const { baseline, current } = halves(input.startDate, input.endDate);
  const bingSite = input.bingSiteUrl ?? input.siteUrl;

  const googleHalf = async (window: {
    startDate: string;
    endDate: string;
  }): Promise<EngineRow[]> => {
    const gsc = await gscFor(ctx);
    const response = await gsc.query({
      siteUrl: input.siteUrl,
      startDate: window.startDate,
      endDate: window.endDate,
      dimensions: ['query'],
      rowLimit: input.limit,
    });
    return normalizeGscRows(response.rows);
  };

  const [baseGoogleResult, nowGoogleResult, bingResult] = await Promise.allSettled([
    googleHalf(baseline),
    googleHalf(current),
    (async () => {
      const bing = await bingFor(ctx);
      return bing.getQueryStats(bingSite);
    })(),
  ]);

  const googleError =
    baseGoogleResult.status === 'rejected'
      ? errorMessage(baseGoogleResult.reason)
      : nowGoogleResult.status === 'rejected'
        ? errorMessage(nowGoogleResult.reason)
        : null;

  // Google is comparable only when BOTH halves succeeded. One good half and one
  // failed half cannot produce an honest delta.
  const googleOk =
    baseGoogleResult.status === 'fulfilled' && nowGoogleResult.status === 'fulfilled';

  let bingBaseRows: EngineRow[] | null = null;
  let bingNowRows: EngineRow[] | null = null;
  let bingError: string | null =
    bingResult.status === 'rejected' ? errorMessage(bingResult.reason) : null;
  let bingUndated = 0;

  if (bingResult.status === 'fulfilled') {
    const base = bucketBingQueriesByDate(bingResult.value, baseline);
    const now = bucketBingQueriesByDate(bingResult.value, current);
    bingUndated = base.undated;
    if (base.dated === 0) {
      // Every row came back without a date, so neither half can be attributed.
      // Reporting zero clicks here would be the zero-fill this function bans.
      bingError =
        `Bing returned ${bingResult.value.length} rows but none carried a date, so they ` +
        `cannot be split into baseline and current halves.`;
    } else {
      bingBaseRows = base.rows;
      bingNowRows = now.rows;
    }
  }

  const coverage = buildCoverage({
    google: { rows: googleOk ? nowGoogleResult.value : null, error: googleError },
    bing: { rows: bingNowRows, error: bingError },
  });

  const index = (rows: EngineRow[] | null): Map<string, EngineRow> =>
    new Map((rows ?? []).map((row) => [row.key, row]));

  const baseGoogle = index(googleOk ? baseGoogleResult.value : null);
  const nowGoogle = index(googleOk ? nowGoogleResult.value : null);
  const baseBing = index(bingBaseRows);
  const nowBing = index(bingNowRows);

  const keys = new Set<string>([...baseGoogle.keys(), ...baseBing.keys()]);

  const counts: Record<DivergenceClass, number> = {
    google_specific: 0,
    bing_specific: 0,
    broad: 0,
    insufficient_data: 0,
  };
  const findings: {
    key: string;
    classification: DivergenceClass;
    meaning: string;
    google: { baselineClicks: number | null; currentClicks: number | null; delta: number | null };
    bing: { baselineClicks: number | null; currentClicks: number | null; delta: number | null };
  }[] = [];

  for (const key of keys) {
    // `null` when the engine is unavailable for this comparison — distinct from a
    // real 0, which means the engine answered and this key had no clicks.
    const gBase = googleOk ? (baseGoogle.get(key)?.clicks ?? 0) : null;
    const gNow = googleOk ? (nowGoogle.get(key)?.clicks ?? 0) : null;
    const bBase = bingBaseRows !== null ? (baseBing.get(key)?.clicks ?? 0) : null;
    const bNow = bingNowRows !== null ? (nowBing.get(key)?.clicks ?? 0) : null;

    const googleDelta =
      gBase === null || gNow === null ? null : fractionalDelta(gBase, gNow);
    const bingDelta = bBase === null || bNow === null ? null : fractionalDelta(bBase, bNow);

    const classification = classifyDivergence(
      {
        googleDelta,
        bingDelta,
        googleBaseClicks: gBase ?? 0,
        bingBaseClicks: bBase ?? 0,
      },
      { threshold: input.threshold, minClicks: input.minClicks },
    );
    counts[classification] += 1;

    if (classification === 'insufficient_data') continue;

    findings.push({
      key,
      classification,
      meaning: DIVERGENCE_MEANING[classification],
      google: { baselineClicks: gBase, currentClicks: gNow, delta: googleDelta },
      bing: { baselineClicks: bBase, currentClicks: bNow, delta: bingDelta },
    });
  }

  findings.sort((a, b) => (a.google.delta ?? 0) - (b.google.delta ?? 0));
  const listed = findings.slice(0, input.limit);

  const undatedNote =
    bingUndated > 0
      ? ` ${bingUndated} Bing row${bingUndated === 1 ? '' : 's'} carried no date and were ` +
        `excluded from both halves.`
      : '';

  const summary =
    `${listed.length} diverging queries for ${input.siteUrl}: ` +
    `${counts.google_specific} Google-specific, ${counts.bing_specific} Bing-specific, ` +
    `${counts.broad} broad. ${counts.insufficient_data} excluded as insufficient data ` +
    `(baseline under ${input.minClicks} clicks on an engine, an engine unavailable for ` +
    `this comparison, or no move past ${Math.round(input.threshold * 100)}%). ` +
    `Google windowed server-side; Bing fetched once and bucketed locally by row date.` +
    undatedNote;

  return jsonResult(summary, {
    siteUrl: input.siteUrl,
    baseline,
    current,
    threshold: input.threshold,
    minClicks: input.minClicks,
    counts,
    coverage,
    bingUndatedRows: bingUndated,
    findings: listed,
  });
}
