/**
 * Re-export shim — the HTTP seam now lives in `@aeo/backlinks`.
 *
 * The provider modules were extracted into the shared `@aeo/backlinks` package.
 * This shim keeps the historical `./lib/http.js` import path working for the
 * tool tests (which import the `HttpClient`/`TextResponse` types) while the tool
 * source files import directly from `@aeo/backlinks`.
 */
export { createLiveHttpClient } from '@aeo/backlinks';
export type { HttpClient, TextResponse, LiveHttpClientOptions } from '@aeo/backlinks';
