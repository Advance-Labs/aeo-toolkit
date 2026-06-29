/**
 * SSRF-guarded fetch. All network/DNS I/O is injected so the guard logic is unit-tested offline.
 *
 * Order of checks (each closes a known SSRF bypass):
 *   scheme allowlist → DNS resolve → reject if ANY resolved IP is private (rebind defense) →
 *   fetch with manual redirects → re-run the whole check on every redirect target → body/time caps.
 */
import type { SafeFetchResult, SafeFetchBlockReason } from '@aeo/types';
import { isBlockedAddress } from './address.js';

/** Minimal response the injected fetch must return (decoupled from the global `fetch`/`Response`). */
export interface GuardResponse {
  status: number;
  body: string;
  /** Redirect target when `status` is 3xx; the guard re-validates it before following. */
  location?: string | null;
}

export interface SafeFetchDeps {
  /** Resolve a hostname to its IP addresses (e.g. `dns.promises.resolve`). */
  resolve(hostname: string): Promise<string[]>;
  /** Perform one HTTP request with manual redirect handling; honor `signal` for timeouts. */
  fetchImpl(url: string, signal: AbortSignal): Promise<GuardResponse>;
}

export interface SafeFetchOptions {
  maxRedirects?: number;
  timeoutMs?: number;
  maxBodyBytes?: number;
  allowedSchemes?: string[];
}

const DEFAULTS: Required<SafeFetchOptions> = {
  maxRedirects: 5,
  timeoutMs: 10_000,
  maxBodyBytes: 2_000_000,
  allowedSchemes: ['http:', 'https:'],
};

const TIMEOUT = Symbol('timeout');

function blocked(url: string, reason: SafeFetchBlockReason): SafeFetchResult {
  return { ok: false, status: 0, url, body: '', blockedReason: reason };
}

export async function safeFetch(
  initialUrl: string,
  options: SafeFetchOptions,
  deps: SafeFetchDeps,
): Promise<SafeFetchResult> {
  const opt = { ...DEFAULTS, ...options };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opt.timeoutMs);
  let url = initialUrl;
  try {
    for (let hop = 0; hop <= opt.maxRedirects; hop++) {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return blocked(url, 'dns-resolution-failed');
      }
      if (!opt.allowedSchemes.includes(parsed.protocol)) return blocked(url, 'scheme-not-allowed');

      let ips: string[];
      try {
        ips = await deps.resolve(parsed.hostname);
      } catch {
        return blocked(url, 'dns-resolution-failed');
      }
      if (!ips || ips.length === 0) return blocked(url, 'dns-resolution-failed');
      if (ips.some(isBlockedAddress)) return blocked(url, 'private-address');

      const res = await race(deps.fetchImpl(url, controller.signal), controller.signal);
      if (res === TIMEOUT) return blocked(url, 'timeout');

      if (res.status >= 300 && res.status < 400 && res.location) {
        url = new URL(res.location, url).toString();
        continue;
      }
      if (Buffer.byteLength(res.body, 'utf8') > opt.maxBodyBytes) return blocked(url, 'body-too-large');
      return { ok: res.status >= 200 && res.status < 300, status: res.status, url, body: res.body };
    }
    return blocked(url, 'too-many-redirects');
  } finally {
    clearTimeout(timer);
  }
}

/** Resolve to the fetch result, or to the TIMEOUT sentinel if the signal aborts first. */
function race<T>(p: Promise<T>, signal: AbortSignal): Promise<T | typeof TIMEOUT> {
  if (signal.aborted) return Promise.resolve(TIMEOUT);
  return new Promise<T | typeof TIMEOUT>((resolve, reject) => {
    const onAbort = () => resolve(TIMEOUT);
    signal.addEventListener('abort', onAbort, { once: true });
    p.then(
      (v) => {
        signal.removeEventListener('abort', onAbort);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener('abort', onAbort);
        reject(e);
      },
    );
  });
}
