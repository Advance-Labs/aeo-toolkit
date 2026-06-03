/** OAuth scope constants for the Google APIs this package talks to. */

/** Read-only access to GA4 Data API (Analytics reporting). */
export const GA4_READONLY_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

/** Read-only access to Google Search Console (webmasters). */
export const GSC_READONLY_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

/**
 * GA4 Admin API read scope. The Admin `accountSummaries` surface is covered by the standard
 * `analytics.readonly` scope, so this aliases it — exported separately so call sites that list
 * properties can name the access they need without coupling to the Data-API constant.
 */
export const GA4_ADMIN_READONLY_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

/**
 * Read-WRITE access to Google Search Console (webmasters). Required by sitemap submission
 * ({@link GscClient.submitSitemap}); the read-only scope cannot mutate sitemaps. Request this
 * explicitly via {@link GoogleOAuth}'s `scopes` option — it is NOT in the default set.
 */
export const GSC_SITEMAPS_SCOPE = 'https://www.googleapis.com/auth/webmasters';

/** Default read-only scope set granted by {@link GoogleOAuth} when none are supplied. */
export const DEFAULT_READONLY_SCOPES: readonly string[] = [GA4_READONLY_SCOPE, GSC_READONLY_SCOPE];
