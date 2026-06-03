/**
 * Environment + server configuration for the GA4 + GSC MCP server.
 *
 * Pure parsing of `process.env` into a typed shape. Google OAuth credentials are
 * optional at boot so the server still starts (and tools still register) when only
 * a static `GOOGLE_ACCESS_TOKEN` is supplied for local development — the OAuth
 * callback path is only needed for the hosted Claude.ai connector flow.
 */

/** Resolved Google OAuth client credentials (present only when all three are set). */
export interface GoogleOAuthEnv {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface ServerConfig {
  /** Public base URL of this MCP server (used for .well-known discovery). */
  publicUrl: string;
  /** Google OAuth client config, or `null` when not fully configured. */
  oauth: GoogleOAuthEnv | null;
  /**
   * A pre-issued Google access token for single-user local dev. When present it
   * is used as the default credential so the tools run without an OAuth round-trip.
   */
  staticAccessToken: string | null;
  /** Token-bucket rate limit applied to every tool call. */
  rateLimit: { capacity: number; refillPerSec: number };
}

const DEFAULT_PUBLIC_URL = 'http://localhost:8787';

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

  return {
    publicUrl: optionalEnv(env, 'MCP_PUBLIC_URL') ?? DEFAULT_PUBLIC_URL,
    oauth,
    staticAccessToken: optionalEnv(env, 'GOOGLE_ACCESS_TOKEN'),
    rateLimit: {
      capacity: intEnv(env, 'MCP_RATE_CAPACITY', 30),
      refillPerSec: intEnv(env, 'MCP_RATE_REFILL_PER_SEC', 5),
    },
  };
}
