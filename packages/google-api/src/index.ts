/**
 * @aeo/google-api — GA4 Data API + Search Console clients and Google OAuth.
 *
 * All network I/O flows through an injectable `Fetcher` (default: global `fetch`); no heavy
 * `googleapis` dependency. Read-only scopes by default. Stubs (Admin listProperties, sitemap
 * submission) are typed at their seams and clearly marked.
 */
export { Ga4Client } from './ga4.js';
export type { Ga4ClientOptions } from './ga4.js';

export { GscClient } from './gsc.js';
export type { GscClientOptions } from './gsc.js';

export { GoogleOAuth } from './oauth.js';
export type { GoogleOAuthConfig } from './oauth.js';

export { InMemoryTokenStore } from './token-store.js';

export {
  DEFAULT_READONLY_SCOPES,
  GA4_ADMIN_READONLY_SCOPE,
  GA4_READONLY_SCOPE,
  GSC_READONLY_SCOPE,
  GSC_SITEMAPS_SCOPE,
} from './scopes.js';

export { GoogleApiError } from './http.js';
export type { Fetcher, FetchInit, FetchResponse } from './http.js';

// Re-export the TokenStore contract so consumers can type their own adapters without a second
// import from `@aeo/types`.
export type { TokenStore } from '@aeo/types';
