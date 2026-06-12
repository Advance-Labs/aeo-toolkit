/**
 * Browser-side Supabase auth client factory (`@supabase/ssr`).
 *
 * Used by client components (e.g. the login form's `signInWithOtp` call) to start the magic-link
 * flow. Uses the anon/publishable key, which is safe in the browser because RLS enforces per-user
 * access. Returns null when auth is not configured (dormant mode) so callers can render a graceful
 * "sign-in isn't enabled yet" state instead of crashing.
 *
 * Requires the `@supabase/ssr` dependency (installed by the assembly agent; see B3 in the contract).
 */

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
// Import the constants from `./config` (client-safe), NOT `./index` — the barrel re-exports `./server`,
// which imports `next/headers` and cannot be bundled into a client component. See `./config`.
import { AUTH_ENABLED, SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

/**
 * Create a browser Supabase client bound to the document cookies, or `null` when auth is not
 * configured. The `@supabase/ssr` browser client transparently manages the auth cookies the server
 * client and middleware read, keeping SSR and client session state in sync.
 *
 * @returns A configured {@link SupabaseClient}, or `null` in dormant mode.
 */
export function createBrowserSupabase(): SupabaseClient | null {
  if (!AUTH_ENABLED || SUPABASE_URL === undefined || SUPABASE_ANON_KEY === undefined) {
    return null;
  }
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
