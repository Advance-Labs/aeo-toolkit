/**
 * Thin typed seam over `@advance-labs/llm`'s `complete`.
 *
 * Every agent depends on the `CompleteFn` type, not on `@advance-labs/llm` directly, so tests inject a
 * mock with zero network and zero credentials. The production wiring is `defaultComplete`.
 */
import { complete } from '@advance-labs/llm';
import type { CompleteOptions } from '@advance-labs/llm';
import type { LlmCompletionRequest, LlmCompletionResponse } from '@advance-labs/types';

/** The single LLM operation the agents need. Matches `@advance-labs/llm`'s `complete` signature. */
export type CompleteFn = (
  req: LlmCompletionRequest,
  opts?: CompleteOptions,
) => Promise<LlmCompletionResponse>;

/** Production implementation: delegate straight to `@advance-labs/llm`. */
export const defaultComplete: CompleteFn = (req, opts) => complete(req, opts);
