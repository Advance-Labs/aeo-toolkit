/**
 * Thin wrapper over `@supabase/supabase-js` `createClient`. Centralizing construction here keeps
 * the SDK import in one place and applies the toolkit's defaults (no session persistence — these
 * are service-role, server-side clients that should never carry a browser auth session).
 */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseClientConfig {
  /** Project URL, e.g. `https://xxxx.supabase.co`. */
  url: string;
  /** Service-role key. Server-only; never exposed to clients, never logged. */
  serviceKey: string;
}

/**
 * Create a server-side Supabase client with session persistence disabled.
 *
 * The returned client is the real SDK client; callers inject it into {@link SupabaseTokenStore}
 * so that tests can substitute a fake with the same chainable shape and avoid any network.
 */
export function createSupabaseClient(config: SupabaseClientConfig): SupabaseClient {
  if (config.url.length === 0 || config.serviceKey.length === 0) {
    throw new Error('createSupabaseClient requires a non-empty url and serviceKey');
  }
  return createClient(config.url, config.serviceKey, {
    auth: { persistSession: false },
  });
}
