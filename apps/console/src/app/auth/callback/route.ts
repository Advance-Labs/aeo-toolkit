/**
 * GET /auth/callback — Supabase magic-link / PKCE callback.
 *
 * The magic-link email points here with a `?code=`. We exchange that code for a session (which sets
 * the auth cookies via the SSR client) and redirect to `/account`. Dormant-safe: when auth is not
 * configured we simply redirect home, and any exchange error redirects to the login page rather than
 * surfacing a 500.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/auth/server';
import { AUTH_ENABLED } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Resolve the origin to redirect back to. Prefers the forwarded host (behind Vercel's proxy) in
 * production so the redirect lands on the user-facing domain, falling back to the request origin.
 */
function resolveOrigin(request: NextRequest): string {
  const { origin } = new URL(request.url);
  if (process.env.NODE_ENV === 'development') return origin;
  const forwardedHost = request.headers.get('x-forwarded-host');
  return forwardedHost !== null ? `https://${forwardedHost}` : origin;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const base = resolveOrigin(request);

  // Dormant mode: nothing to exchange — send the visitor home.
  if (!AUTH_ENABLED) {
    return NextResponse.redirect(`${base}/`);
  }

  const code = new URL(request.url).searchParams.get('code');
  if (code === null) {
    return NextResponse.redirect(`${base}/login`);
  }

  const supabase = await createServerSupabase();
  if (supabase === null) {
    return NextResponse.redirect(`${base}/`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error !== null) {
    return NextResponse.redirect(`${base}/login?error=auth`);
  }

  return NextResponse.redirect(`${base}/account`);
}
