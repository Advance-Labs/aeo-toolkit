#!/usr/bin/env node
/**
 * Manual, human-run smoke test against the REAL Bing Webmaster API.
 *
 * This never runs in CI — there is no Bing credential in that environment, and
 * this script is not wired into any workflow or test command. Run it by hand
 * (`pnpm --filter @advance-labs/bing-api verify:bing`) when you want to confirm
 * the client still talks to Bing correctly, e.g. after touching `webmaster.ts`
 * or `dates.ts`.
 *
 * Reads `BING_API_KEY` and `BING_VERIFY_SITE` from the environment. Exits
 * non-zero with a clear message naming whichever is missing, before making
 * any request.
 *
 * BOTH QUESTIONS THIS SCRIPT EXISTED TO SETTLE ARE NOW SETTLED (2026-09-09,
 * against a live key on a real verified site). The answers are recorded in the
 * fixtures and asserted in `webmaster.test.ts`:
 *
 *  1. `GetQueryStats` returns one row per (query x date), NOT one aggregate per
 *     query: `maxRowsForOneQuery=3` across `distinctDates=6`. Per-date bucketing is
 *     therefore possible, which is what `engine_divergence` now relies on.
 *  2. `GetPageStats` keys the page URL under `Query`, not `Url`. It reuses the
 *     QueryStats wire type outright and emits no `Url` field at all. The same holds
 *     for `GetQueryPageStats`. The old `||` fallback across both spellings is gone.
 *
 * Two further facts the hand-written fixtures had wrong, now captured:
 *
 *  - Live WCF dates arrive with NO timezone offset (`/Date(1784851200000)/`), not
 *    the offset-bearing form the docs show. `dates.ts` never trusted the offset, so
 *    this was already handled.
 *  - `AvgClickPosition` is `-1` on every zero-click row. It is a sentinel, not a
 *    position, and `positionOrNull` in `webmaster.ts` now maps it to `null` at the
 *    client boundary.
 *
 * The script remains useful as a regression check: re-run it after touching
 * `webmaster.ts` or `dates.ts` to confirm Bing has not changed shape underneath us.
 * The raw dumps below are what make a shape change visible.
 */
import { BingWebmasterClient, requestBing, defaultFetcher, BING_API_BASE } from '../dist/index.js';

function requireEnv(name) {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    console.error(`verify:bing: missing required environment variable ${name}.`);
    console.error(
      'Set BING_API_KEY (from Bing Webmaster Tools > Settings > API Access) and ' +
        'BING_VERIFY_SITE (a site URL you have verified, e.g. "https://example.com/").',
    );
    process.exit(1);
  }
  return value;
}

const apiKey = requireEnv('BING_API_KEY');
const siteUrl = requireEnv('BING_VERIFY_SITE');

const client = new BingWebmasterClient({ apiKey });

const sites = await client.listSites();
console.log(`listSites(): ${sites.length} site(s). First 3:`);
console.log(JSON.stringify(sites.slice(0, 3), null, 2));

const queries = await client.getQueryStats(siteUrl);
console.log(`\ngetQueryStats(${siteUrl}): ${queries.length} row(s). First 3:`);
console.log(JSON.stringify(queries.slice(0, 3), null, 2));

// --- query-stats shape: settles "one aggregate per query" vs "one row per (query x date)" ---
const distinct = new Set(queries.map((r) => r.query));
const dates = new Set(queries.map((r) => r.date));
console.log(`\nrows=${queries.length} distinctQueries=${distinct.size} distinctDates=${dates.size}`);
console.log(`nullDates=${queries.filter((r) => r.date === null).length}`);
const byQuery = new Map();
for (const r of queries) byQuery.set(r.query, [...(byQuery.get(r.query) ?? []), r]);
const worst = [...byQuery.values()].sort((a, b) => b.length - a.length)[0];
console.log(`maxRowsForOneQuery=${worst?.length ?? 0}`);
console.log(JSON.stringify(worst?.slice(0, 5), null, 2));

// --- raw `d`-unwrapped payloads, BEFORE our normalization, straight from Bing ---
// GetQueryStats: shows Bing's real field names and real WCF date strings.
const rawQueryStats = await requestBing(defaultFetcher(), {
  baseUrl: BING_API_BASE,
  method: 'GetQueryStats',
  apiKey,
  params: { siteUrl },
});
console.log('\nraw GetQueryStats (first 2 rows, unnormalized):');
console.log(JSON.stringify((Array.isArray(rawQueryStats) ? rawQueryStats : []).slice(0, 2), null, 2));

// GetPageStats: settles whether the page URL arrives under `Query` or `Url`.
const rawPageStats = await requestBing(defaultFetcher(), {
  baseUrl: BING_API_BASE,
  method: 'GetPageStats',
  apiKey,
  params: { siteUrl },
});
console.log('\nraw GetPageStats (first 2 rows, unnormalized):');
console.log(JSON.stringify((Array.isArray(rawPageStats) ? rawPageStats : []).slice(0, 2), null, 2));
