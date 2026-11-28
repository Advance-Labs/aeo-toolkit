---
"@advance-labs/net-guard": minor
---

Security: close a DNS-rebinding SSRF bypass in `createLiveSafeFetchDeps` (CWE-918, CWE-367).

The live deps validated one DNS answer, then let `fetch` connect by hostname and resolve again, so a
TTL-0 record could answer "public" to the guard and "127.0.0.1" to the connection. Requests now go
through `node:http(s)` with `guardedLookup`, which validates inside the connection's own lookup, so
the socket can only open to an address that passed the check. A blocked connect-time answer returns
`blockedReason: 'private-address'`.

New exports: `guardedLookup` (reuse it in a custom `fetchImpl`) and `GUARD_BLOCKED`.

Reported by Vishal Suwalka (vishalsuwalkaj@gmail.com).
