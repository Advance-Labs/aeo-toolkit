/**
 * Auth configuration constants — the client-safe core of the auth module.
 *
 * This file holds ONLY plain env reads and a derived boolean. It imports nothing server-only (no
 * `next/headers`, no `@supabase/ssr`), so it is safe to pull into both the browser client
 * (`./client`) and the server client (`./server`) without dragging server-only code into the client
 * bundle. The barrel (`./index`) re-exports these so existing `@/lib/auth` import sites stay stable.
 *
 * The commercial layer ships dormant: with no Supabase auth env configured, the site behaves exactly
 * as today (all tools free and open, no sign-in walls). {@link AUTH_ENABLED} is the single source of
 * truth for "is sign-in available?" — every auth surface (server client, browser client, login page,
 * callback, middleware) branches on it so the feature lights up only when both env vars are present,
 * mirroring the repo's existing "lights up when creds are added" convention (e.g. ga-gsc).
 */

/**
 * Public Supabase project URL. `NEXT_PUBLIC_` so it is inlined into the client bundle. Distinct from
 * the server-only `SUPABASE_URL` used by the service-role tooling; both point at the same project.
 */
export const SUPABASE_URL: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL;

/**
 * Anon / publishable key — safe to ship to the browser (RLS enforces per-user access). Distinct from
 * the service-role key, which stays server-only for webhooks and never appears here.
 */
export const SUPABASE_ANON_KEY: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Whether Supabase Auth is configured. True only when BOTH the project URL and the anon key are
 * present and non-empty. When false the app is in dormant mode: the auth clients return null,
 * `getSession`/`getUser` return null, the login page shows a graceful "not enabled yet" state, and
 * middleware skips session refresh entirely. Evaluated once at module load.
 */
export const AUTH_ENABLED: boolean =
  typeof SUPABASE_URL === 'string' &&
  SUPABASE_URL.length > 0 &&
  typeof SUPABASE_ANON_KEY === 'string' &&
  SUPABASE_ANON_KEY.length > 0;
