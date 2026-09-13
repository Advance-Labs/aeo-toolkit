# @advance-labs/bing-api

Bing Webmaster Tools JSON/HTTP client for the AEO Toolkit. **Read-only by
construction**: `BingWebmasterClient` has no method that calls any of the
twenty-six write operations on Bing's `IWebmasterApi` (submitting URLs or
content, adding/removing sites, saving crawl settings, and so on) — those
methods simply do not exist on this class, so there is nothing to accidentally
call. All network I/O flows through an **injectable `Fetcher`** (default: the
platform global `fetch`), so the client is unit-testable without a live
network.

## Usage

```ts
import { BingWebmasterClient } from '@advance-labs/bing-api';

const bing = new BingWebmasterClient({ apiKey: process.env.BING_API_KEY! });

const sites = await bing.listSites();
const queries = await bing.getQueryStats('https://example.com/');
const pages = await bing.getPageStats('https://example.com/');
const crawlStats = await bing.getCrawlStats('https://example.com/');
```

Every method takes the site URL exactly as verified in Bing Webmaster Tools
(e.g. `"https://example.com/"`) and returns a plain array or object — never a
raw Bing payload.

## The `d` envelope

Every Bing Webmaster JSON response wraps its real payload in a `d` property:
`{ "d": [...] }` or `{ "d": { ... } }`. This is a leftover of the WCF Data
Services stack the API was built on, not anything meaningful to a caller.
`requestBing` (in `http.ts`) unwraps it exactly once, in one place, so none of
the twelve client methods on `BingWebmasterClient` has to know the envelope
exists. A response that is missing `d` — or isn't an object at all — throws a
`BingApiError` naming the method and the keys that actually came back, rather
than handing a caller `undefined` and letting a `TypeError` surface three
calls later.

## The WCF date gotcha

Bing does not return ISO 8601 dates. It returns the ASP.NET AJAX / WCF date
format: a string that looks like `/Date(1399100400000-0700)/`. The number is
milliseconds since the Unix epoch, and it is **already UTC** — but the trailing
`-0700` (or `+0000`, or nothing at all) looks exactly like a UTC offset you'd
need to apply, and it isn't one. It records the timezone Bing's server was in
when it rendered the string, and carries no information this client needs. Add
it to the timestamp and you get a value that is wrong by however many hours
that offset was, while still looking entirely plausible — the worst kind of
bug, because nothing about the resulting date looks broken.

`parseWcfDate` (in `dates.ts`) discards the offset group deliberately and
parses only the millisecond value. It throws `WcfDateError` on anything that
isn't exactly the `/Date(ms[±hhmm])/` shape, rather than ever falling back to
`new Date(raw)` — a fallback there would silently accept the WCF string as an
invalid date (or, worse, a garbage-but-valid one) instead of failing loudly.
`toWcfDate` does the reverse for the rare case of writing a date back into a
Bing-shaped request (no offset suffix is emitted, since the value is already
UTC).

## Testing this client for real

`scripts/verify.mjs` (run via `pnpm --filter @advance-labs/bing-api
verify:bing`) is a manual smoke test against the real Bing Webmaster API. It
needs `BING_API_KEY` and `BING_VERIFY_SITE` in the environment and is never
run in CI.
