/**
 * Thin typed seam over `@aeo/llm`'s `complete`.
 *
 * Every agent depends on the `CompleteFn` type, not on `@aeo/llm` directly, so tests inject a
 * mock with zero network and zero credentials. The production wiring is `defaultComplete`.
 */
import { complete } from '@aeo/llm';
import type { CompleteOptions } from '@aeo/llm';
import type { LlmCompletionRequest, LlmCompletionResponse } from '@aeo/types';

/** The single LLM operation the agents need. Matches `@aeo/llm`'s `complete` signature. */
export type CompleteFn = (
  req: LlmCompletionRequest,
  opts?: CompleteOptions,
) => Promise<LlmCompletionResponse>;

/** Production implementation: delegate straight to `@aeo/llm`. */
export const defaultComplete: CompleteFn = (req, opts) => complete(req, opts);
