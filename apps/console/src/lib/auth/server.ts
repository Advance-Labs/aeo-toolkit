/**
 * Server-side Supabase auth client (App Router, `@supabase/ssr`).
 *
 * This is the cookie-aware, anon-key client used in Server Components, Route Handlers, and Server
 * Actions to read the signed-in user's session. It is SEPARATE from the service-role client in
 * `@advance-labs/storage` (`createSupabaseClient`), which bypasses RLS for webhooks and is untouched here.
 *
 * Dormant-safe: when {@link AUTH_ENABLED} is false (no Supabase auth env), the factory returns null
 * and {@link getSession}/{@link getUser} resolve to null — the site behaves exactly as today.
 *
 * Requires the `@supabase/ssr` dependency (installed by the assembly agent; see B3 in the contract).
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
// Import constants from `./config` (not the `./index` barrel) to avoid a server↔client import cycle.
import { AUTH_ENABLED, SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

/**
 * Create a request-scoped, cookie-bound Supabase client using the anon/publishable key.
 *
 * Reads and writes Supabase auth cookies through Next's async `cookies()` store via the
 * `getAll`/`setAll` interface required by `@supabase/ssr`. The `setAll` write is wrapped in a
 * try/catch because Server Components cannot mutate cookies — there the write is a no-op and the
 * middleware ({@link file://./middleware.ts}) is responsible for refreshing the session cookie.
 *
 * @returns A configured {@link SupabaseClient}, or `null` when auth is not configured (dormant mode).
 */
export async function createServerSupabase(): Promise<SupabaseClient | null> {
  if (!AUTH_ENABLED || SUPABASE_URL === undefined || SUPABASE_ANON_KEY === undefined) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component where cookies are read-only. Safe to ignore: the
          // middleware refreshes the session cookie on the next request to a protected route.
        }
      },
    },
  });
}

/**
 * Resolve the current auth session, or `null` when auth is dormant or no user is signed in.
 *
 * Never throws on the dormant path. Note: prefer {@link getUser} for authorization decisions —
 * `getSession` returns the cookie-stored session without revalidating it against the auth server.
 */
export async function getSession(): Promise<Session | null> {
  const supabase = await createServerSupabase();
  if (supabase === null) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * Resolve the current authenticated user (validated against the Supabase auth server), or `null`
 * when auth is dormant or no user is signed in. Use this — not {@link getSession} — to gate access.
 */
export async function getUser(): Promise<User | null> {
  const supabase = await createServerSupabase();
  if (supabase === null) return null;
  const { data } = await supabase.auth.getUser();
  return data.user;
}
