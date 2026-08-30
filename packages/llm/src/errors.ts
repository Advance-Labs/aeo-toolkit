/** Typed error subclasses so callers can branch on failure mode without string matching. */

import type { LlmProvider } from '@advance-labs/types';

/** Base class for every error this package throws. */
export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** The upstream provider returned a non-2xx HTTP status. */
export class LlmHttpError extends LlmError {
  constructor(
    readonly provider: LlmProvider,
    readonly status: number,
    readonly statusText: string,
    /** Raw upstream body, truncated. Never contains the BYOK key (it lives only in request headers). */
    readonly body: string,
  ) {
    super(`@advance-labs/llm: ${provider} request failed with HTTP ${status} ${statusText}`);
  }
}

/** The provider responded 2xx but the body could not be parsed into the expected shape. */
export class LlmResponseError extends LlmError {
  constructor(
    readonly provider: LlmProvider,
    message: string,
  ) {
    super(`@advance-labs/llm: ${provider} returned an unexpected response — ${message}`);
  }
}

/** The request itself is malformed (e.g. missing API key, unknown provider). */
export class LlmRequestError extends LlmError {}
