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
import { AuthorityError, lookupAuthority } from '@/lib/authority';
import type { AuthorityReport } from '@/lib/authority';

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

  try {
    const report = await lookupAuthority(payload.domains);
    return NextResponse.json(report, { status: 200 });
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
