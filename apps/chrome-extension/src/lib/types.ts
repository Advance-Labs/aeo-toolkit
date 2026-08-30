/**
 * App-local view models. All shared domain shapes come from `@advance-labs/types`; these
 * are only the extension-specific envelopes the popup renders.
 */
import type { AuditReport, SiteFilePresence } from '@advance-labs/types';

/** A single rendered check row in the popup's checklist. */
export interface CheckRow {
  id: string;
  category: string;
  title: string;
  passed: boolean;
  severity: string;
  recommendation: string;
}

/**
 * The finished, serializable result the background worker hands to the popup.
 * `report` is the full `@advance-labs/scoring` `AuditReport`; the rest are convenience
 * fields the popup surfaces directly (site-file presence, the page audited).
 */
export interface AuditPayload {
  pageUrl: string;
  origin: string;
  report: AuditReport;
  filePresence: SiteFilePresence;
  /** Raw fetched site files for display / debugging. */
  siteFiles: {
    robotsTxt: string | null;
    sitemapXml: string | null;
    llmsTxt: string | null;
  };
}
