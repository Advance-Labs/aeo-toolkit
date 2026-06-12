/**
 * Auth module barrel.
 *
 * Re-exports the client-safe config constants (from `./config`) plus the server and browser client
 * factories, so `@/lib/auth` remains the single import surface for server-side consumers (middleware,
 * route handlers, server components). The constants live in `./config` — a module with NO server-only
 * imports — so the browser client (`./client`) can read them without this barrel pulling `./server`
 * (and its `next/headers` import) into the client bundle.
 *
 * The commercial layer ships dormant: with no Supabase auth env configured, the site behaves exactly
 * as today (all tools free and open, no sign-in walls). See {@link AUTH_ENABLED} in `./config`.
 */

export { AUTH_ENABLED, SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
export { createServerSupabase, getSession, getUser } from './server';
export { createBrowserSupabase } from './client';
