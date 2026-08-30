# @advance-labs/llm

Provider-agnostic, **bring-your-own-key (BYOK)** LLM client for the AEO Toolkit. A single
`complete()` call fans out to Anthropic, OpenAI, Groq, Perplexity Sonar, or the Vercel AI Gateway
based on `req.provider`. There are **no provider SDKs** — every request is a plain `fetch` through
an injectable `Fetcher`, so the client is fully unit-testable without live network access. API keys
are request-scoped and are never logged or persisted.

## Usage

```ts
import { complete } from '@advance-labs/llm';
import type { LlmCompletionRequest } from '@advance-labs/types';

const req: LlmCompletionRequest = {
  provider: 'anthropic', // 'openai' | 'groq' | 'perplexity' | 'gateway'
  model: 'claude-sonnet-4-20250514',
  apiKey: process.env.ANTHROPIC_API_KEY!, // BYOK — never stored
  messages: [
    { role: 'system', content: 'You are concise.' },
    { role: 'user', content: 'Summarize answer-engine optimization in one sentence.' },
  ],
  maxTokens: 256,
  temperature: 0.2,
};

const res = await complete(req);
console.log(res.text);
// Perplexity also populates res.citations: Citation[]
```

The default fetcher uses the runtime global `fetch`. Inject your own for tests, proxies, or custom
runtimes:

```ts
await complete(req, { fetcher: myFetcher });
```

### Provider routing

| `provider`   | Endpoint                                      | Auth header                       | Notes                                            |
| ------------ | --------------------------------------------- | --------------------------------- | ------------------------------------------------ |
| `anthropic`  | `https://api.anthropic.com/v1/messages`       | `x-api-key` + `anthropic-version` | `system` hoisted; parses `content[].text` blocks |
| `openai`     | `https://api.openai.com/v1/chat/completions`  | `Bearer`                          | OpenAI Chat Completions shape                     |
| `groq`       | `https://api.groq.com/openai/v1/chat/completions` | `Bearer`                      | OpenAI-compatible                                |
| `perplexity` | `https://api.perplexity.ai/chat/completions`  | `Bearer`                          | Extracts top-level `citations` → `Citation[]`    |
| `gateway`    | `https://ai-gateway.vercel.sh/v1/chat/completions` | `Bearer`                     | `model` passed verbatim as `"provider/model"`    |

## Public API

| Export                                                 | Kind     | Description                                                        |
| ------------------------------------------------------ | -------- | ----------------------------------------------------------------- |
| `complete(req, opts?)`                                 | function | Routes a `LlmCompletionRequest` to its provider, returns `LlmCompletionResponse`. |
| `CompleteOptions`                                      | type     | `{ fetcher?: Fetcher }` — inject a custom network function.        |
| `buildMessages(messages)`                              | function | Splits messages into a hoisted `system` string + ordered `chat`.  |
| `extractCitations(raw)`                                | function | Normalizes Perplexity citations (string or object form) to `Citation[]`. |
| `BuiltMessages`                                        | type     | Return shape of `buildMessages`.                                  |
| `Fetcher`, `FetchResponse`                             | type     | The injectable I/O seam.                                          |
| `defaultFetcher`                                       | function | Fetcher bound to the runtime global `fetch`.                      |
| `LlmError`                                             | class    | Base error.                                                       |
| `LlmHttpError`                                         | class    | Non-2xx upstream status (`provider`, `status`, `body`).           |
| `LlmResponseError`                                     | class    | 2xx body that did not parse to the expected shape.                |
| `LlmRequestError`                                      | class    | Malformed request (missing key, unknown provider).               |

All domain types (`LlmCompletionRequest`, `LlmCompletionResponse`, `LlmMessage`, `Citation`, …) are
imported from `@advance-labs/types`.

## Status

**Implemented.** All five provider routes (Anthropic, OpenAI, Groq, Perplexity, Vercel AI Gateway)
are fully wired against their real HTTP APIs with typed error handling and citation extraction. No
live credential is required to build or test; tests mock the fetcher entirely. No stubs.
