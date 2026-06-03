/** OAuth scope constants for the Google APIs this package talks to. */

/** Read-only access to GA4 Data API (Analytics reporting). */
export const GA4_READONLY_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

/** Read-only access to Google Search Console (webmasters). */
export const GSC_READONLY_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

/** Default read-only scope set granted by {@link GoogleOAuth} when none are supplied. */
export const DEFAULT_READONLY_SCOPES: readonly string[] = [GA4_READONLY_SCOPE, GSC_READONLY_SCOPE];
