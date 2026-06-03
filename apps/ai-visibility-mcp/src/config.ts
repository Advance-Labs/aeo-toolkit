/**
 * Server-wide constants and environment-derived configuration.
 *
 * BYOK note: Perplexity (and any other LLM) keys are NEVER read from the
 * environment here — they arrive per request as a tool argument and are passed
 * straight through to `@aeo/llm`. The only env this module reads is hosted-mode
 * OAuth issuer/resource URLs for `.well-known` discovery.
 */

export const SERVER_NAME = 'ai-visibility-mcp';
export const SERVER_VERSION = '0.1.0';

/**
 * Token-bucket rate limit guarding every tool call. Visibility tools fan out to
 * Perplexity and the crawler, so we keep the bucket modest.
 */
export const RATE_LIMIT = { capacity: 20, refillPerSec: 5 } as const;

/** Perplexity Sonar is the AI-search engine whose citations we inspect. */
export const PERPLEXITY_PROVIDER = 'perplexity' as const;
export const PERPLEXITY_MODEL = 'sonar' as const;

/**
 * For the prompt-discovery and competitor tools we use the same Perplexity Sonar
 * route — the user's BYOK key is reused for the generation step so no extra
 * credential is required.
 */
export const DISCOVERY_MODEL = 'sonar' as const;

/** Page cap for the AEO crawl. AEO scoring is dominated by the landing page. */
export const AEO_MAX_PAGES = 10;

/** Polite per-host spacing for the crawl, in milliseconds. */
export const CRAWL_PER_HOST_RATE_LIMIT_MS = 500;

/** Default number of generated prompts to actually test in `discover_ranking_prompts`. */
export const DEFAULT_DISCOVER_TEST_COUNT = 3;

/**
 * Hosted-mode OAuth discovery configuration, derived from the environment.
 * `issuer`/`resource` default to a placeholder so `.well-known` handlers always
 * return a well-formed document even before deployment env is wired.
 */
export interface OAuthDiscoveryEnv {
  issuer: string;
  resource: string;
  authorizationServers: string[];
}

export function readOAuthDiscoveryEnv(
  env: Record<string, string | undefined> = process.env,
): OAuthDiscoveryEnv {
  const resource = env.MCP_PUBLIC_URL ?? 'https://ai-visibility-mcp.example.com';
  const issuer = env.OAUTH_ISSUER ?? resource;
  const authServers = env.OAUTH_AUTHORIZATION_SERVERS;
  const authorizationServers =
    authServers && authServers.trim().length > 0
      ? authServers
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [issuer];
  return { issuer, resource, authorizationServers };
}
