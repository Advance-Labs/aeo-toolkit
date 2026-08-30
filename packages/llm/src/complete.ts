/**
 * `complete` — the single public entry point. Switches on `req.provider` and delegates to the
 * matching adapter. All network I/O flows through the injected (or default) `Fetcher`, so the
 * function is fully unit-testable without live HTTP.
 *
 * BYOK: `req.apiKey` is read straight into the request headers and is never logged or persisted.
 */

import type { LlmCompletionRequest, LlmCompletionResponse } from '@advance-labs/types';
import type { Fetcher } from './fetcher.js';
import { defaultFetcher } from './fetcher.js';
import { LlmRequestError } from './errors.js';
import { completeAnthropic } from './providers/anthropic.js';
import { completeOpenAiCompatible } from './providers/openai-compatible.js';

export interface CompleteOptions {
  /** Inject a custom network function. Defaults to the runtime global `fetch`. */
  fetcher?: Fetcher;
}

export function complete(
  req: LlmCompletionRequest,
  opts: CompleteOptions = {},
): Promise<LlmCompletionResponse> {
  if (typeof req.apiKey !== 'string' || req.apiKey.length === 0) {
    throw new LlmRequestError(
      '@advance-labs/llm: `apiKey` is required (BYOK) and must be a non-empty string.',
    );
  }
  if (typeof req.model !== 'string' || req.model.length === 0) {
    throw new LlmRequestError('@advance-labs/llm: `model` is required and must be a non-empty string.');
  }

  const fetcher = opts.fetcher ?? defaultFetcher;

  switch (req.provider) {
    case 'anthropic':
      return completeAnthropic(req, fetcher);
    case 'openai':
    case 'groq':
    case 'perplexity':
    case 'gateway':
      return completeOpenAiCompatible(req.provider, req, fetcher);
    default: {
      // Exhaustiveness guard: if `LlmProvider` gains a member, this fails to compile.
      const exhaustive: never = req.provider;
      throw new LlmRequestError(`@advance-labs/llm: unsupported provider "${String(exhaustive)}".`);
    }
  }
}
