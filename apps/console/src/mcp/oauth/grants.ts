/**
 * The records behind every sealed string the MCP authorization server hands out, and the checks that
 * decide whether a code becomes tokens.
 *
 * Readers validate shape as well as the seal: a record that authenticates but lacks a field is a
 * record from some other version of this code, and is refused like a forgery.
 */
import { createHash, timingSafeEqual } from 'node:crypto';

import { SEARCH_SCOPE } from './config.js';
import { seal, unseal } from './seal.js';

/** Long enough for the Google consent round-trip, short enough that an abandoned flow dies. */
export const REQUEST_TTL_SECONDS = 10 * 60;
/**
 * Codes are not single-use (there is no table to burn them in), so they live for two minutes. PKCE
 * is what makes a replay useless: redeeming a code needs the verifier, which never leaves the client.
 */
export const CODE_TTL_SECONDS = 2 * 60;
export const ACCESS_TTL_SECONDS = 60 * 60;
export const REFRESH_TTL_SECONDS = 90 * 24 * 60 * 60;

/** A registered client. The client id IS this record, sealed. */
export type ClientRecord = { redirectUris: string[]; name?: string };

/** An `/authorize` request waiting on the Google round-trip. Lives in a cookie. */
export type PendingRequest = {
  cid: string;
  redirectUri: string;
  challenge: string;
  state?: string;
  resource?: string;
};

export type CodeRecord = {
  sub: string;
  cid: string;
  redirectUri: string;
  challenge: string;
  resource?: string;
};

/** What an access or refresh token asserts: this client acts for this stored Google connection. */
export type GrantRecord = { sub: string; cid: string; resource?: string };

export type TokenResponse = {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
};

const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isOptStr = (v: unknown): v is string | undefined => v === undefined || isStr(v);

/** Include an optional field only when it has a value (keeps sealed payloads free of `undefined`). */
function opt<K extends string>(key: K, value: string | undefined): Partial<Record<K, string>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, string>);
}

/**
 * A short, stable handle for a client id. Client ids are whole sealed records, so codes and tokens
 * carry this hash instead of repeating one inside the other.
 */
export function clientKey(clientId: string): string {
  return createHash('sha256').update(clientId).digest('base64url').slice(0, 22);
}

export function registerClient(record: ClientRecord, secret: string): string {
  return seal('client', { redirectUris: record.redirectUris, ...opt('name', record.name) }, secret);
}

export function readClient(clientId: string | null, secret: string): ClientRecord | null {
  const r = unseal('client', clientId, secret);
  if (r === null || !Array.isArray(r.redirectUris) || r.redirectUris.length === 0) return null;
  if (!r.redirectUris.every(isStr) || !isOptStr(r.name)) return null;
  return { redirectUris: r.redirectUris, ...opt('name', r.name) };
}

export function sealPending(req: PendingRequest, secret: string): string {
  return seal(
    'request',
    {
      cid: req.cid,
      redirectUri: req.redirectUri,
      challenge: req.challenge,
      ...opt('state', req.state),
      ...opt('resource', req.resource),
    },
    secret,
    { ttlSeconds: REQUEST_TTL_SECONDS },
  );
}

export function readPending(value: string | undefined, secret: string): PendingRequest | null {
  const r = unseal('request', value, secret);
  if (r === null || !isStr(r.cid) || !isStr(r.redirectUri) || !isStr(r.challenge)) return null;
  if (!isOptStr(r.state) || !isOptStr(r.resource)) return null;
  return {
    cid: r.cid,
    redirectUri: r.redirectUri,
    challenge: r.challenge,
    ...opt('state', r.state),
    ...opt('resource', r.resource),
  };
}

export function issueCode(code: CodeRecord, secret: string, now?: number): string {
  return seal(
    'code',
    {
      sub: code.sub,
      cid: code.cid,
      redirectUri: code.redirectUri,
      challenge: code.challenge,
      ...opt('resource', code.resource),
    },
    secret,
    { ttlSeconds: CODE_TTL_SECONDS, ...(now !== undefined ? { now } : {}) },
  );
}

export function readCode(value: string | null, secret: string, now?: number): CodeRecord | null {
  const r = unseal('code', value, secret, now);
  if (r === null || !isStr(r.sub) || !isStr(r.cid) || !isStr(r.redirectUri) || !isStr(r.challenge)) {
    return null;
  }
  if (!isOptStr(r.resource)) return null;
  return {
    sub: r.sub,
    cid: r.cid,
    redirectUri: r.redirectUri,
    challenge: r.challenge,
    ...opt('resource', r.resource),
  };
}

export function readGrant(
  kind: 'access' | 'refresh',
  value: string | null,
  secret: string,
  now?: number,
): GrantRecord | null {
  const r = unseal(kind, value, secret, now);
  if (r === null || !isStr(r.sub) || !isStr(r.cid) || !isOptStr(r.resource)) return null;
  return { sub: r.sub, cid: r.cid, ...opt('resource', r.resource) };
}

/** Mint a fresh access + refresh pair. Refresh rotates: every refresh returns a new refresh token. */
export function issueTokens(grant: GrantRecord, secret: string, now?: number): TokenResponse {
  const payload = { sub: grant.sub, cid: grant.cid, ...opt('resource', grant.resource) };
  const at = now !== undefined ? { now } : {};
  return {
    access_token: seal('access', payload, secret, { ttlSeconds: ACCESS_TTL_SECONDS, ...at }),
    token_type: 'Bearer',
    expires_in: ACCESS_TTL_SECONDS,
    refresh_token: seal('refresh', payload, secret, { ttlSeconds: REFRESH_TTL_SECONDS, ...at }),
    scope: SEARCH_SCOPE,
  };
}

/** RFC 7636 verifier alphabet and length. */
const VERIFIER_RE = /^[A-Za-z0-9\-._~]{43,128}$/;

/** RFC 7636 S256: `BASE64URL(SHA256(verifier)) === challenge`, compared in constant time. */
export function verifyPkce(verifier: string | null, challenge: string): boolean {
  if (verifier === null || !VERIFIER_RE.test(verifier)) return false;
  const computed = Buffer.from(createHash('sha256').update(verifier).digest('base64url'));
  const expected = Buffer.from(challenge);
  return computed.length === expected.length && timingSafeEqual(computed, expected);
}
