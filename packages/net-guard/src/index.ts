/**
 * @advance-labs/net-guard — an SSRF-guarded HTTP fetch seam.
 *
 * Use {@link safeFetch} for ANY request to a user-supplied or otherwise untrusted URL (outreach
 * prospect fetches, link-placement verification). It resolves DNS and refuses private/loopback/
 * link-local/CGNAT/cloud-metadata targets, re-validates every redirect hop, and caps body + time.
 *
 * The guard logic is pure and injected; {@link createLiveSafeFetchDeps} wires it to Node's DNS and
 * the global `fetch` for production use.
 */
import { promises as dns } from 'node:dns';
import type { SafeFetchDeps, GuardResponse } from './safe-fetch.js';

export { safeFetch } from './safe-fetch.js';
export type { SafeFetchDeps, GuardResponse, SafeFetchOptions } from './safe-fetch.js';
export { isBlockedAddress } from './address.js';
export type { SafeFetchResult, SafeFetchBlockReason } from '@advance-labs/types';

/**
 * Live deps for {@link safeFetch} using Node DNS + global `fetch` (manual redirects).
 *
 * NOTE: this resolves the hostname for validation, then lets `fetch` connect by hostname — so a
 * narrow TOCTOU rebind window remains. The multi-address check in `safeFetch` mitigates the common
 * case; for hard pinning, supply a `fetchImpl` that connects to the already-validated IP.
 */
export function createLiveSafeFetchDeps(): SafeFetchDeps {
  return {
    resolve: async (hostname: string): Promise<string[]> => {
      const records = await dns.lookup(hostname, { all: true });
      return records.map((r) => r.address);
    },
    fetchImpl: async (url: string, signal: AbortSignal): Promise<GuardResponse> => {
      const res = await fetch(url, { redirect: 'manual', signal });
      const isRedirect = res.status >= 300 && res.status < 400;
      return {
        status: res.status,
        location: res.headers.get('location'),
        body: isRedirect ? '' : await res.text(),
      };
    },
  };
}
