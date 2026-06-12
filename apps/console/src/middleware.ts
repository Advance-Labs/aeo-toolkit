/**
 * Edge middleware — Supabase SSR session refresh for the commercial layer.
 *
 * Scope (B7): runs ONLY on `/account` and `/api/billing/*` (see `config.matcher`). It refreshes the
 * Supabase auth cookie so Server Components and billing routes see a valid session. It deliberately
 * does NOT gate or redirect — public routes and the five free tools are never in the matcher, so they
 * are completely untouched.
 *
 * Dormant-safe: when {@link AUTH_ENABLED} is false the function returns immediately, so with no auth
 * env configured the middleware is an inert pass-through and the site behaves exactly as today.
 *
 * Requires the `@supabase/ssr` dependency (installed by the assembly agent; see B3 in the contract).
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_ENABLED, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/auth';

export async function middleware(request: NextRequest): Promise<NextResponse> {
  // Dormant mode — never touch the request when auth isn't configured.
  if (!AUTH_ENABLED || SUPABASE_URL === undefined || SUPABASE_ANON_KEY === undefined) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // IMPORTANT: getUser() (not getSession()) is the call that refreshes the cookie. Do not insert code
  // between client creation and this call — it can cause hard-to-debug random sign-outs.
  await supabase.auth.getUser();

  return response;
}

/**
 * Tight matcher: only the authenticated surfaces. Public routes and the free tools are intentionally
 * absent so they are never processed by this middleware.
 */
export const config = {
  matcher: ['/account/:path*', '/api/billing/:path*'],
};
