/**
 * Request/response shapes for `POST /api/chat`, shared between the route handler and the client.
 * Kept local to the app (not a domain type) since they are transport DTOs specific to this tool.
 */
import type { LlmProvider } from '@aeo/types';

export interface ChatRequestBody {
  question: string;
  propertyId: string;
  siteUrl: string;
  llmProvider: LlmProvider;
  model: string;
  /** BYOK — request-scoped only; never persisted or logged server-side. */
  apiKey: string;
}

export interface ChatResponseBody {
  answer: string;
  model: string;
  /** The compact GA4 + GSC context the answer was grounded in (returned for transparency). */
  dataContext: string;
}

export interface ChatErrorBody {
  error: string;
}

const PROVIDERS: readonly LlmProvider[] = ['anthropic', 'openai', 'groq', 'perplexity', 'gateway'];

function isProvider(value: unknown): value is LlmProvider {
  return typeof value === 'string' && (PROVIDERS as readonly string[]).includes(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate and narrow an unknown JSON body into a {@link ChatRequestBody}. Returns a typed error
 * string instead of throwing so the route can map it to a 400.
 */
export function parseChatRequest(body: unknown): ChatRequestBody | { error: string } {
  if (typeof body !== 'object' || body === null) {
    return { error: 'Request body must be a JSON object.' };
  }
  const record = body as Record<string, unknown>;

  if (!nonEmptyString(record['question'])) return { error: 'question is required.' };
  if (!nonEmptyString(record['propertyId'])) return { error: 'propertyId is required.' };
  if (!nonEmptyString(record['siteUrl'])) return { error: 'siteUrl is required.' };
  if (!isProvider(record['llmProvider'])) {
    return { error: `llmProvider must be one of: ${PROVIDERS.join(', ')}.` };
  }
  if (!nonEmptyString(record['model'])) return { error: 'model is required.' };
  if (!nonEmptyString(record['apiKey'])) return { error: 'apiKey is required (BYOK).' };

  return {
    question: record['question'].trim(),
    propertyId: record['propertyId'].trim(),
    siteUrl: record['siteUrl'].trim(),
    llmProvider: record['llmProvider'],
    model: record['model'].trim(),
    apiKey: record['apiKey'],
  };
}
