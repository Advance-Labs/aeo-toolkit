/**
 * Re-export shim — the Wayback CDX adapter now lives in `@aeo/backlinks`.
 */
export { fetchHistory, parseCdx, timestampToIso, buildCdxUrl } from '@aeo/backlinks';
export type { WaybackSnapshot, WaybackOutcome } from '@aeo/backlinks';
