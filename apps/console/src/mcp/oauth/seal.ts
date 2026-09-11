/**
 * Sealed, self-describing strings for the MCP authorization server: client ids, the pending-request
 * cookie, authorization codes, and access and refresh tokens.
 *
 * Each is `<prefix><base64url(iv | tag | ciphertext)>`: AES-256-GCM over a JSON payload stamped with
 * `iat` and, when it has a lifetime, `exp`. The kind is bound twice, as the prefix and as GCM
 * additional data, so a refresh token presented as an access token (or a code presented as a client
 * id) fails authentication instead of being read as the wrong thing.
 *
 * Unsealing never throws. Anything forged, truncated, sealed under another secret, of the wrong kind
 * or past its `exp` comes back `null`, and callers treat every `null` the same way.
 *
 * The key is HMAC-SHA256(secret, label). It is cheap, which matters because an access token is
 * unsealed on every MCP call (the scrypt derivation the token store uses costs tens of milliseconds),
 * and the label keeps this key distinct from any other use of the same secret.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

const PREFIXES = {
  client: 'aeo_client_',
  request: 'aeo_req_',
  code: 'aeo_code_',
  access: 'aeo_at_',
  refresh: 'aeo_rt_',
} as const;

export type SealKind = keyof typeof PREFIXES;

/** How the MCP route recognises a token this server issued, as opposed to a raw Google token. */
export const ACCESS_TOKEN_PREFIX = PREFIXES.access;

const KEY_LABEL = 'aeo-toolkit::mcp-oauth::v1';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

type Payload = Record<string, unknown>;

function keyFor(secret: string): Buffer {
  return createHmac('sha256', secret).update(KEY_LABEL).digest();
}

const seconds = (ms: number): number => Math.floor(ms / 1000);

export function seal(
  kind: SealKind,
  payload: Payload,
  secret: string,
  opts: { ttlSeconds?: number; now?: number } = {},
): string {
  const now = seconds(opts.now ?? Date.now());
  const body: Payload = { ...payload, iat: now };
  if (opts.ttlSeconds !== undefined) body.exp = now + opts.ttlSeconds;

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, keyFor(secret), iv);
  cipher.setAAD(Buffer.from(kind));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(body), 'utf8'), cipher.final()]);
  return PREFIXES[kind] + Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
}

export function unseal(
  kind: SealKind,
  value: string | null | undefined,
  secret: string,
  now: number = Date.now(),
): Payload | null {
  const prefix = PREFIXES[kind];
  if (typeof value !== 'string' || !value.startsWith(prefix)) return null;

  const raw = Buffer.from(value.slice(prefix.length), 'base64url');
  if (raw.length <= IV_BYTES + TAG_BYTES) return null;

  let body: unknown;
  try {
    const decipher = createDecipheriv(ALGORITHM, keyFor(secret), raw.subarray(0, IV_BYTES));
    decipher.setAAD(Buffer.from(kind));
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    const plaintext = Buffer.concat([
      decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)),
      decipher.final(),
    ]);
    body = JSON.parse(plaintext.toString('utf8'));
  } catch {
    return null;
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const exp = (body as Payload).exp;
  if (typeof exp === 'number' && exp <= seconds(now)) return null;
  return body as Payload;
}
