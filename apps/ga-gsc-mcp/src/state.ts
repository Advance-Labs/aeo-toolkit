/**
 * Signed OAuth `state` parameter.
 *
 * The hosted connect flow can never trust the `state` value Google echoes back
 * verbatim — anyone could forge `?state=<victim-user-id>` and have the callback
 * write tokens under someone else's identity. Instead we mint `state` ourselves at
 * the start of the flow as `userId.timestamp.signature`, where `signature` is an
 * HMAC-SHA256 over `userId.timestamp` keyed by {@link OAUTH_STATE_SECRET_ENV}. The
 * callback re-derives the signature with a timing-safe compare and rejects anything
 * tampered with or older than {@link STATE_TTL_MS}.
 *
 * The secret comes only from the environment (`OAUTH_STATE_SECRET`); it is never
 * hard-coded and never logged. The encoded `state` carries only an opaque user id
 * and a timestamp — no secret material.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

/** Env var holding the HMAC signing secret for OAuth state. */
export const OAUTH_STATE_SECRET_ENV = 'OAUTH_STATE_SECRET';

/** State is valid for 10 minutes after issuance — long enough for a consent screen. */
export const STATE_TTL_MS = 10 * 60_000;

/** Thrown when a `state` value fails verification (tampered, malformed, or expired). */
export class InvalidStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStateError';
  }
}

/** Field separator. `.` cannot appear in a base64url payload, so parsing is unambiguous. */
const SEP = '.';

/** Resolve the HMAC secret from the environment, or throw if it is absent. */
function resolveSecret(env: NodeJS.ProcessEnv): string {
  const raw = env[OAUTH_STATE_SECRET_ENV];
  const trimmed = raw?.trim();
  if (trimmed === undefined || trimmed.length === 0) {
    throw new InvalidStateError(
      `${OAUTH_STATE_SECRET_ENV} is not set; cannot sign or verify OAuth state.`,
    );
  }
  return trimmed;
}

/** base64url-encode a UTF-8 string (no padding) so it is safe inside a query param. */
function encodePart(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

/** Inverse of {@link encodePart}. */
function decodePart(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

/** Compute the HMAC-SHA256 signature (base64url) over the signed payload. */
function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

/**
 * Mint a signed `state` value binding `userId` to the current time.
 *
 * @param userId opaque, verified user identity to round-trip through the OAuth flow.
 * @param now    injectable clock (ms) for deterministic tests; defaults to `Date.now()`.
 * @returns `base64url(userId).timestamp.signature`.
 */
export function signState(
  userId: string,
  now: number = Date.now(),
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (userId.length === 0) {
    throw new InvalidStateError('Cannot sign state for an empty user id.');
  }
  const secret = resolveSecret(env);
  const encodedUser = encodePart(userId);
  const timestamp = String(now);
  const signed = `${encodedUser}${SEP}${timestamp}`;
  const signature = sign(signed, secret);
  return `${signed}${SEP}${signature}`;
}

/** Constant-time comparison of two signatures, length-safe (no early-exit leak). */
function signaturesMatch(expected: string, actual: string): boolean {
  const expectedBuf = Buffer.from(expected, 'utf8');
  const actualBuf = Buffer.from(actual, 'utf8');
  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }
  return timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Verify a signed `state` value and return the embedded user id.
 *
 * Rejects (throwing {@link InvalidStateError}) when the value is malformed, the
 * signature does not match, or the timestamp is older than {@link STATE_TTL_MS}
 * (or implausibly in the future).
 *
 * @param state the `state` query param Google redirected back with.
 * @param now   injectable clock (ms) for deterministic tests; defaults to `Date.now()`.
 * @returns the verified user id encoded by {@link signState}.
 */
export function verifyState(
  state: string,
  now: number = Date.now(),
  env: NodeJS.ProcessEnv = process.env,
): string {
  const secret = resolveSecret(env);
  const parts = state.split(SEP);
  if (parts.length !== 3) {
    throw new InvalidStateError('Malformed state: expected three dot-separated parts.');
  }
  const encodedUser = parts[0]!;
  const timestampRaw = parts[1]!;
  const providedSignature = parts[2]!;
  if (encodedUser.length === 0 || timestampRaw.length === 0 || providedSignature.length === 0) {
    throw new InvalidStateError('Malformed state: empty segment.');
  }

  const signed = `${encodedUser}${SEP}${timestampRaw}`;
  const expectedSignature = sign(signed, secret);
  if (!signaturesMatch(expectedSignature, providedSignature)) {
    throw new InvalidStateError('State signature mismatch.');
  }

  const issuedAt = Number(timestampRaw);
  if (!Number.isFinite(issuedAt)) {
    throw new InvalidStateError('Malformed state: non-numeric timestamp.');
  }
  const age = now - issuedAt;
  if (age > STATE_TTL_MS) {
    throw new InvalidStateError('State has expired.');
  }
  if (age < -STATE_TTL_MS) {
    // Tolerate small clock skew but reject timestamps far in the future.
    throw new InvalidStateError('State timestamp is in the future.');
  }

  return decodePart(encodedUser);
}
