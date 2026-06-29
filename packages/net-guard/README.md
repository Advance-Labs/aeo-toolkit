# @aeo/net-guard

SSRF-guarded HTTP fetch seam. Closes finding **C1** of the Autopilot security review: the existing
crawler/backlinks HTTP layer follows redirects with no private-IP guard, so a user-supplied URL can
reach `169.254.169.254` (cloud metadata), `localhost`, or RFC-1918 hosts.

## Use it for any untrusted URL

```ts
import { safeFetch, createLiveSafeFetchDeps } from '@aeo/net-guard';

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

All logic is pure and injected (`resolve`, `fetchImpl`) — unit-tested with zero network. See
`docs/CONVENTIONS-autopilot.md` invariant #1.
