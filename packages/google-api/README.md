# @advance-labs/google-api

GA4 Data API + Google Search Console clients and a Google OAuth 2.0 helper for the AEO Toolkit.
All network I/O flows through an **injectable `Fetcher`** (default: the platform global `fetch`),
so there is no heavy `googleapis` dependency and every code path is unit-testable without a live
network. The clients default to **read-only** scopes — the toolkit never requests more access than
it needs.

## Usage

```ts
import {
  Ga4Client,
  GscClient,
  GoogleOAuth,
  InMemoryTokenStore,
  GA4_READONLY_SCOPE,
  GSC_READONLY_SCOPE,
} from '@advance-labs/google-api';

// 1. OAuth: send the user to consent, then exchange the returned code.
const oauth = new GoogleOAuth({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: 'https://app.example.com/oauth/callback',
  // scopes default to [GA4_READONLY_SCOPE, GSC_READONLY_SCOPE]
});
const consentUrl = oauth.getAuthUrl('csrf-state');
const tokens = await oauth.exchangeCode(codeFromCallback);

const store = new InMemoryTokenStore(); // swap for an encrypted adapter in production
await store.set('user-123', tokens);

// 2. GA4: run a report.
const ga4 = new Ga4Client({ accessToken: tokens.accessToken });
const report = await ga4.runReport({
  propertyId: '123456',
  dateRanges: [{ startDate: '2024-01-01', endDate: '2024-01-31' }],
  dimensions: ['date', 'pagePath'],
  metrics: ['screenPageViews', 'totalUsers'],
  limit: 100,
});

// 3. GSC: query search analytics.
const gsc = new GscClient({ accessToken: tokens.accessToken });
const sites = await gsc.listSites();
const search = await gsc.query({
  siteUrl: 'https://example.com/',
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  dimensions: ['query', 'page'],
  rowLimit: 50,
});

// When the access token expires, refresh it.
const refreshed = await oauth.refresh(tokens.refreshToken!);
```

### Injecting a custom fetcher (e.g. for tests or `undici`)

```ts
const client = new Ga4Client({ accessToken: 'tok', fetcher: myFetch });
```

The `fetcher` is `(input: string, init?: FetchInit) => Promise<FetchResponse>` — a minimal
structural subset of the DOM `fetch`.

## Public API

| Export | Kind | Description |
|---|---|---|
| `Ga4Client` | class | `runReport(req)` → `Ga4Report` (live POST to `analyticsdata.googleapis.com/v1beta`); `listProperties()` → `Ga4Property[]` (live GET to the Admin API `accountSummaries`, paginated). |
| `Ga4ClientOptions` | type | `{ accessToken; fetcher? }`. |
| `GscClient` | class | `query(req)` → `GscReport`, `listSites()` → `GscSite[]`, `submitSitemap(siteUrl, feedpath)` → `void` (live calls to `searchconsole.googleapis.com/webmasters/v3`; submission needs the write scope). |
| `GscClientOptions` | type | `{ accessToken; fetcher? }`. |
| `GoogleOAuth` | class | `getAuthUrl(state)`, `exchangeCode(code)`, `refresh(refreshToken)`. Defaults to read-only scopes, offline access. |
| `GoogleOAuthConfig` | type | `{ clientId; clientSecret; redirectUri; scopes?; fetcher? }`. |
| `InMemoryTokenStore` | class | `TokenStore` implementation for tests/local dev; clones on read & write. |
| `TokenStore` | type | Re-exported from `@advance-labs/types` — implement for an encrypted/durable adapter. |
| `GA4_READONLY_SCOPE` | const | `analytics.readonly`. |
| `GA4_ADMIN_READONLY_SCOPE` | const | `analytics.readonly` — the Admin `accountSummaries` surface is covered by the same scope. |
| `GSC_READONLY_SCOPE` | const | `webmasters.readonly`. |
| `GSC_SITEMAPS_SCOPE` | const | `webmasters` (read-WRITE) — required by `submitSitemap`; opt-in, not in the default set. |
| `DEFAULT_READONLY_SCOPES` | const | `[GA4_READONLY_SCOPE, GSC_READONLY_SCOPE]`. |
| `GoogleApiError` | class | Thrown on non-2xx responses; carries `status` and raw `body`. |
| `Fetcher`, `FetchInit`, `FetchResponse` | types | The injectable HTTP seam. |

Shared data shapes (`Ga4ReportRequest`, `Ga4Report`, `Ga4Row`, `GscQueryRequest`, `GscReport`,
`GscRow`, `GscSite`, `Ga4Property`, `GoogleOAuthTokens`) come from `@advance-labs/types`.

## Status

**Implemented (all unit-tested against mocked fetchers):** `Ga4Client.runReport`,
`Ga4Client.listProperties` (live GA4 Admin API `accountSummaries`, with `nextPageToken`
pagination up to a safety cap), `GscClient.query`, `GscClient.listSites`,
`GscClient.submitSitemap` (live `PUT …/sitemaps/{feedpath}` — requires the read-WRITE
`webmasters` scope, which is opt-in via `GoogleOAuth`'s `scopes` option),
`GoogleOAuth.getAuthUrl` / `exchangeCode` / `refresh`, `InMemoryTokenStore`, scope constants
(including `GA4_ADMIN_READONLY_SCOPE` and `GSC_SITEMAPS_SCOPE`), `GoogleApiError`, and the
injectable fetch seam.

**Stubbed:** none — every public method now performs its live call through the injectable
`Fetcher`. To submit sitemaps, request `GSC_SITEMAPS_SCOPE` at consent time; the package still
defaults to read-only scopes everywhere else.
