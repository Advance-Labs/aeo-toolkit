import type { AiBotName } from '@advance-labs/types';

/**
 * Known AI / LLM crawler user-agents we probe for in robots.txt. Mirrors the `AiBotName`
 * union in `@advance-labs/types` exactly — kept as a runtime constant so callers can iterate.
 */
export const AI_BOT_NAMES: readonly AiBotName[] = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Bytespider',
  'Amazonbot',
  'meta-externalagent',
] as const;

/** Default polite user-agent. Identifies the toolkit and points operators at docs. */
export const DEFAULT_USER_AGENT =
  'AeoToolkitCrawler/0.1 (+https://github.com/advance-labs/aeo-toolkit)';

/** Defaults applied when the corresponding `CrawlOptions` field is omitted. */
export const DEFAULT_CONCURRENCY = 4;
export const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
export const DEFAULT_PER_HOST_RATE_LIMIT_MS = 0;
export const DEFAULT_MAX_DEPTH = 5;

/** Cap on how many redirect hops we follow manually before giving up. */
export const MAX_REDIRECT_HOPS = 10;
