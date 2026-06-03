/**
 * @aeo/llm — provider-agnostic, BYOK LLM client.
 *
 * One `complete()` call fans out to Anthropic, OpenAI, Groq, Perplexity Sonar, or the Vercel AI
 * Gateway based on `req.provider`. No provider SDKs; all I/O goes through an injectable `Fetcher`
 * (defaults to the runtime global `fetch`). API keys are request-scoped and never logged.
 */

export { complete } from './complete.js';
export type { CompleteOptions } from './complete.js';

export { buildMessages, extractCitations } from './helpers.js';
export type { BuiltMessages } from './helpers.js';

export type { Fetcher, FetchResponse } from './fetcher.js';
export { defaultFetcher } from './fetcher.js';

export { LlmError, LlmHttpError, LlmResponseError, LlmRequestError } from './errors.js';
