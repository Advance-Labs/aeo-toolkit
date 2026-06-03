# @aeo/google-api

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
} from '@aeo/google-api';

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
| `Ga4Client` | class | `runReport(req)` → `Ga4Report` (live POST to `analyticsdata.googleapis.com/v1beta`); `listProperties()` (stub). |
| `Ga4ClientOptions` | type | `{ accessToken; fetcher? }`. |
| `GscClient` | class | `query(req)` → `GscReport`, `listSites()` → `GscSite[]` (live calls to `searchconsole.googleapis.com/webmasters/v3`); `submitSitemap()` (stub). |
| `GscClientOptions` | type | `{ accessToken; fetcher? }`. |
| `GoogleOAuth` | class | `getAuthUrl(state)`, `exchangeCode(code)`, `refresh(refreshToken)`. Defaults to read-only scopes, offline access. |
| `GoogleOAuthConfig` | type | `{ clientId; clientSecret; redirectUri; scopes?; fetcher? }`. |
| `InMemoryTokenStore` | class | `TokenStore` implementation for tests/local dev; clones on read & write. |
| `TokenStore` | type | Re-exported from `@aeo/types` — implement for an encrypted/durable adapter. |
| `GA4_READONLY_SCOPE` | const | `analytics.readonly`. |
| `GSC_READONLY_SCOPE` | const | `webmasters.readonly`. |
| `DEFAULT_READONLY_SCOPES` | const | `[GA4_READONLY_SCOPE, GSC_READONLY_SCOPE]`. |
| `GoogleApiError` | class | Thrown on non-2xx responses; carries `status` and raw `body`. |
| `Fetcher`, `FetchInit`, `FetchResponse` | types | The injectable HTTP seam. |

Shared data shapes (`Ga4ReportRequest`, `Ga4Report`, `Ga4Row`, `GscQueryRequest`, `GscReport`,
`GscRow`, `GscSite`, `Ga4Property`, `GoogleOAuthTokens`) come from `@aeo/types`.

## Status

**Implemented:** `Ga4Client.runReport`, `GscClient.query`, `GscClient.listSites`,
`GoogleOAuth.getAuthUrl` / `exchangeCode` / `refresh`, `InMemoryTokenStore`, scope constants,
`GoogleApiError`, and the injectable fetch seam — all unit-tested against mocked fetchers.

**Stubbed:** `Ga4Client.listProperties` (returns `[]` — needs the GA4 Admin API
`accountSummaries` surface) and `GscClient.submitSitemap` (throws — needs the read-WRITE
`webmasters` scope). Both are marked `// STUB:` with typed seams at the wiring point.
