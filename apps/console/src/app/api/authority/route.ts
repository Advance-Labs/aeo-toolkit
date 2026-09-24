/**
 * POST /api/authority — look up open-web authority for one or more domains.
 *
 * Body: { domains: string[] }  (1–100; normalized and de-duplicated downstream)
 *
 * Thin by design: all of the logic, and every decision about what counts as a
 * failure, lives in `@/lib/authority`. This handler only validates the envelope
 * and maps `AuthorityError.code` onto an HTTP status.
 */
import { NextResponse } from 'next/server';
import { AuthorityError } from '@/lib/authority';
import type { AuthorityReport } from '@/lib/authority';
import { lookupAuthorityCached } from '@/lib/authority-cache';
import { callerKey, checkMonthlyBudget, checkRateLimit, recordSpend } from '@/lib/authority-limits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AuthorityErrorResponse {
  error: string;
  /** Lets the client pick copy per failure mode instead of regex-ing the message. */
  code: AuthorityError['code'];
}

/**
 * Status per failure mode. `not_configured` is deliberately a 503, not a 500: the
 * service is fine, the operator has not supplied a key, and the UI says so in those
 * words rather than blaming the user's domain.
 */
const STATUS_BY_CODE: Record<AuthorityError['code'], number> = {
  not_configured: 503,
  bad_input: 400,
  upstream_rejected: 502,
  upstream_shape: 502,
  unreachable: 504,
  rate_limited: 429,
  // 503 rather than 429: the caller did nothing wrong, our month's budget is gone.
  quota_exhausted: 503,
};

function isAuthorityRequest(value: unknown): value is { domains: string[] } {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    Array.isArray(candidate.domains) &&
    candidate.domains.length > 0 &&
    candidate.domains.every((d) => typeof d === 'string')
  );
}

export async function POST(
  request: Request,
): Promise<NextResponse<AuthorityReport | AuthorityErrorResponse>> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Request body must be valid JSON.', code: 'bad_input' as const },
      { status: 400 },
    );
  }

  if (!isAuthorityRequest(payload)) {
    return NextResponse.json(
      {
        error: 'Body must be { domains: string[] } with at least one domain.',
        code: 'bad_input' as const,
      },
      { status: 400 },
    );
  }

  // Both gates run before the lookup, because their entire purpose is to avoid it.
  // Rate limit first: it is the cheaper check and the more common rejection.
  const limit = await checkRateLimit(callerKey(request), payload.domains.length);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: limit.message!, code: 'rate_limited' as const },
      {
        status: STATUS_BY_CODE.rate_limited,
        headers: { 'Retry-After': String(limit.retryAfterSeconds ?? 600) },
      },
    );
  }

  const budget = await checkMonthlyBudget();
  if (!budget.allowed) {
    return NextResponse.json(
      { error: budget.message!, code: 'quota_exhausted' as const },
      { status: STATUS_BY_CODE.quota_exhausted },
    );
  }

  try {
    const { report, hits, misses } = await lookupAuthorityCached(payload.domains);
    // Metered after the fact, against what the lookup actually spent upstream.
    // Cache hits are free and must not count, or a launch would exhaust the
    // budget on traffic that never touched the index.
    await recordSpend(misses);
    return NextResponse.json(report, {
      status: 200,
      // Observable in the browser's network tab and in logs, so a launch-day
      // quota question can be answered by looking rather than by guessing.
      headers: { 'X-Authority-Cache': `hit=${hits}, miss=${misses}` },
    });
  } catch (error) {
    if (error instanceof AuthorityError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: STATUS_BY_CODE[error.code] },
      );
    }
    // Unknown failures are not echoed back: an upstream error string can carry
    // request details we have no business forwarding to a browser.
    return NextResponse.json(
      { error: 'Unexpected error during the authority lookup.', code: 'unreachable' as const },
      { status: 500 },
    );
  }
}
