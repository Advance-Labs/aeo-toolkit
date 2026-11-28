# @advance-labs/net-guard

SSRF-guarded HTTP fetch seam. Closes finding **C1** of the Autopilot security review: the existing
crawler/backlinks HTTP layer follows redirects with no private-IP guard, so a user-supplied URL can
reach `169.254.169.254` (cloud metadata), `localhost`, or RFC-1918 hosts.

## Install

```bash
npm install @advance-labs/net-guard
```

## Use it for any untrusted URL

```ts
import { safeFetch, createLiveSafeFetchDeps } from '@advance-labs/net-guard';

const deps = createLiveSafeFetchDeps();
const res = await safeFetch('https://prospect.example/', {}, deps);
if (!res.ok) {
  // res.blockedReason: 'scheme-not-allowed' | 'private-address' | 'dns-resolution-failed'
  //                  | 'too-many-redirects' | 'body-too-large' | 'timeout'
}
```

## What it guards (in order)

1. **Scheme allowlist** — `http:` / `https:` only (rejects `file:`, `gopher:`, …).
2. **DNS resolve + private-address rejection** — refuses if **any** resolved IP is loopback,
   RFC-1918, link-local (incl. the metadata IP), CGNAT, IPv6 ULA/link-local, or an IPv4-mapped
   private address. Malformed addresses **fail closed**.
3. **Per-hop redirect re-validation** — redirects are manual; the full check re-runs on every target,
   so a public host can't 302 you to an internal one.
4. **Body + time caps** — `maxBodyBytes` (default 2 MB) and `timeoutMs` (default 10 s, aborts the request).
5. **Connect-time pinning (DNS rebinding)** — `createLiveSafeFetchDeps()` sends the request through
   `node:http(s)` with `guardedLookup`, which re-checks the answer inside the connection's own DNS
   lookup. The socket can only open to an address that passed the check, so a TTL-0 record that
   flips from public to `127.0.0.1` between lookups is refused (`private-address`).

### Bringing your own `fetchImpl`

The pre-flight `resolve` check alone does **not** stop DNS rebinding: your HTTP client resolves the
host again when it connects. If you replace `fetchImpl`, pass `guardedLookup` as the connection's
`lookup` (Node `http.request`, `https.request`, `net.connect`, or undici's `connect.lookup`).
Versions before 0.3.0 did not do this in `createLiveSafeFetchDeps`; upgrade.

All logic is pure and injected (`resolve`, `fetchImpl`) — unit-tested with zero network. See
[`docs/CONVENTIONS.md`](../../docs/CONVENTIONS.md) security invariant #1.

## License

Apache-2.0. See [LICENSE](https://github.com/Advance-Labs/aeo-toolkit/blob/main/LICENSE).
