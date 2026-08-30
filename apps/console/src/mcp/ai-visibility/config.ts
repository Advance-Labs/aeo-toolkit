/**
 * Constants for the ai-visibility MCP server (re-homed into the console).
 *
 * BYOK note: Perplexity (and any other LLM) keys are NEVER read from the
 * environment — they arrive per request as a tool argument and are passed
 * straight through to `@advance-labs/llm`.
 */

export const SERVER_NAME = 'ai-visibility-mcp';
export const SERVER_VERSION = '0.1.0';

/**
 * In-process token-bucket rate limit guarding every tool call. Visibility tools
 * fan out to Perplexity and the crawler, so we keep the bucket modest. The
 * per-caller distributed limit lives at the route entry (see `mcp/shared.ts`).
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
