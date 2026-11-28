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
import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from 'node:dns';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { SafeFetchDeps, GuardResponse } from './safe-fetch.js';
import { isBlockedAddress } from './address.js';
import { GUARD_BLOCKED } from './safe-fetch.js';

export { safeFetch, GUARD_BLOCKED } from './safe-fetch.js';
export type { SafeFetchDeps, GuardResponse, SafeFetchOptions } from './safe-fetch.js';
export { isBlockedAddress } from './address.js';
export type { SafeFetchResult, SafeFetchBlockReason } from '@advance-labs/types';

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

/**
 * `lookup` hook for `http(s).request` / `net.connect`: resolves the host, refuses the connection if
 * ANY answer is a blocked address, and hands the socket only the addresses it just checked.
 *
 * This is the DNS-rebinding defense. The socket connects to exactly the IP validated here, in the
 * same lookup, so a TTL-0 record that flips between a guard lookup and a connect lookup can't slip
 * past. (IP-literal hosts skip `lookup`; `safeFetch` validates those before connecting.)
 */
export function guardedLookup(hostname: string, options: LookupOptions, callback: LookupCallback): void {
  dnsLookup(hostname, { ...options, all: true }, (err, records) => {
    if (err) return callback(err, []);
    if (records.length === 0 || records.some((r) => isBlockedAddress(r.address))) {
      const blocked: NodeJS.ErrnoException = new Error(`net-guard: ${hostname} resolves to a blocked address`);
      blocked.code = GUARD_BLOCKED;
      return callback(blocked, []);
    }
    if (options.all) return callback(null, records);
    const first = records[0]!;
    callback(null, first.address, first.family);
  });
}

function readBody(res: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    res.on('data', (c: Buffer) => chunks.push(c));
    res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    res.on('error', reject);
  });
}

/**
 * Live deps for {@link safeFetch}: Node DNS for the pre-flight check, and `node:http(s)` with
 * {@link guardedLookup} for the request, so the connection is pinned to a validated address.
 * Redirects are returned to `safeFetch` (never followed here) so every hop is re-validated.
 */
export function createLiveSafeFetchDeps(): SafeFetchDeps {
  return {
    resolve: (hostname: string): Promise<string[]> =>
      new Promise((resolve, reject) => {
        dnsLookup(hostname, { all: true }, (err, records) =>
          err ? reject(err) : resolve(records.map((r) => r.address)),
        );
      }),
    fetchImpl: (url: string, signal: AbortSignal): Promise<GuardResponse> =>
      new Promise((resolve, reject) => {
        const request = new URL(url).protocol === 'https:' ? httpsRequest : httpRequest;
        const req = request(url, { method: 'GET', lookup: guardedLookup, signal }, (res) => {
          const status = res.statusCode ?? 0;
          if (status >= 300 && status < 400) {
            res.resume();
            resolve({ status, location: res.headers.location ?? null, body: '' });
            return;
          }
          readBody(res).then((body) => resolve({ status, body }), reject);
        });
        req.on('error', reject);
        req.end();
      }),
  };
}
