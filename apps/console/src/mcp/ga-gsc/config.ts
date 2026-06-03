/**
 * Environment + server configuration for the GA4 + GSC MCP server (re-homed).
 *
 * Pure parsing of `process.env` into a typed shape. Google OAuth credentials are
 * optional at boot so the server still works (and tools still register) when only
 * a static `GOOGLE_ACCESS_TOKEN` is supplied for local development, or when the
 * caller presents a request-scoped BYOK bearer token.
 */

export const SERVER_NAME = 'ga-gsc-mcp';
export const SERVER_VERSION = '0.1.0';

/** Resolved Google OAuth client credentials (present only when all three are set). */
export interface GoogleOAuthEnv {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Resolved Supabase service credentials for the durable token store (present only
 * when both URL and service-role key are set). `encryptionKey` is optional — when
 * supplied, OAuth tokens are encrypted at rest (AES-256-GCM).
 */
export interface SupabaseEnv {
  url: string;
  serviceRoleKey: string;
  encryptionKey: string | null;
}

export interface ServerConfig {
  /** Google OAuth client config, or `null` when not fully configured. */
  oauth: GoogleOAuthEnv | null;
  /**
   * A pre-issued Google access token for single-user local dev. When present it
   * is used as the default credential so the tools run without an OAuth round-trip.
   */
  staticAccessToken: string | null;
  /**
   * Supabase credentials for the durable, encrypted token store, or `null` to fall
   * back to the in-memory store (local dev / single instance only).
   */
  supabase: SupabaseEnv | null;
  /** In-process token-bucket rate limit applied to every tool call. */
  rateLimit: { capacity: number; refillPerSec: number };
}

/** Read a trimmed, non-empty env var or return `null`. */
function optionalEnv(env: NodeJS.ProcessEnv, key: string): string | null {
  const raw = env[key];
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Parse a positive integer env var, falling back to `fallback` on absence/garbage. */
function intEnv(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = optionalEnv(env, key);
  if (raw === null) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Build the {@link ServerConfig} from an env bag (defaults to `process.env`).
 * Never throws — missing OAuth credentials simply yield `oauth: null`.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const clientId = optionalEnv(env, 'GOOGLE_CLIENT_ID');
  const clientSecret = optionalEnv(env, 'GOOGLE_CLIENT_SECRET');
  const redirectUri = optionalEnv(env, 'GOOGLE_REDIRECT_URI');

  const oauth: GoogleOAuthEnv | null =
    clientId !== null && clientSecret !== null && redirectUri !== null
      ? { clientId, clientSecret, redirectUri }
      : null;

  const supabaseUrl = optionalEnv(env, 'SUPABASE_URL');
  const supabaseServiceKey = optionalEnv(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const supabase: SupabaseEnv | null =
    supabaseUrl !== null && supabaseServiceKey !== null
      ? {
          url: supabaseUrl,
          serviceRoleKey: supabaseServiceKey,
          encryptionKey: optionalEnv(env, 'TOKEN_ENCRYPTION_KEY'),
        }
      : null;

  return {
    oauth,
    staticAccessToken: optionalEnv(env, 'GOOGLE_ACCESS_TOKEN'),
    supabase,
    rateLimit: {
      capacity: intEnv(env, 'MCP_RATE_CAPACITY', 30),
      refillPerSec: intEnv(env, 'MCP_RATE_REFILL_PER_SEC', 5),
    },
  };
}
