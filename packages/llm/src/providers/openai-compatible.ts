/**
 * OpenAI-compatible adapter — POST `<base>/chat/completions` with a Bearer key.
 *
 * Covers four providers that all speak the OpenAI Chat Completions wire format:
 *  - openai      → https://api.openai.com/v1
 *  - groq        → https://api.groq.com/openai/v1
 *  - perplexity  → https://api.perplexity.ai     (also returns top-level `citations`)
 *  - gateway     → https://ai-gateway.vercel.sh/v1 (model passed as a `provider/model` string)
 *
 * The system turn is sent as a leading `{ role: 'system' }` message (OpenAI convention) rather than
 * hoisted, so `buildMessages` is used only to merge multiple system turns into one.
 */

import type { LlmCompletionRequest, LlmCompletionResponse, LlmUsage } from '@aeo/types';
import type { Fetcher } from '../fetcher.js';
import { buildMessages, extractCitations } from '../helpers.js';
import { LlmHttpError, LlmResponseError } from '../errors.js';
import { asRecord, parseJson, readNumber, readString } from '../json.js';

/** Providers that route through the OpenAI-compatible request/response shape. */
export type OpenAiCompatibleProvider = 'openai' | 'groq' | 'perplexity' | 'gateway';

const BASE_URLS: Record<OpenAiCompatibleProvider, string> = {
  openai: 'https://api.openai.com/v1',
  groq: 'https://api.groq.com/openai/v1',
  perplexity: 'https://api.perplexity.ai',
  gateway: 'https://ai-gateway.vercel.sh/v1',
};

export async function completeOpenAiCompatible(
  provider: OpenAiCompatibleProvider,
  req: LlmCompletionRequest,
  fetcher: Fetcher,
): Promise<LlmCompletionResponse> {
  const { system, chat } = buildMessages(req.messages);

  const messages: Array<{ role: string; content: string }> = [];
  if (system !== undefined) messages.push({ role: 'system', content: system });
  for (const turn of chat) messages.push(turn);

  const body: Record<string, unknown> = {
    // Vercel AI Gateway expects the model as a `provider/model` string; the caller supplies that
    // verbatim in `req.model`, so no transformation is needed here.
    model: req.model,
    messages,
  };
  if (req.temperature !== undefined) body['temperature'] = req.temperature;
  if (req.maxTokens !== undefined) body['max_tokens'] = req.maxTokens;

  const endpoint = `${BASE_URLS[provider]}/chat/completions`;
  const res = await fetcher(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${req.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new LlmHttpError(provider, res.status, res.statusText, raw);
  }

  const parsed = asRecord(parseJson(provider, raw));
  if (parsed === undefined) {
    throw new LlmResponseError(provider, 'top-level response was not an object');
  }

  const choices = parsed['choices'];
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new LlmResponseError(provider, 'missing or empty `choices` array');
  }

  const firstChoice = asRecord(choices[0]);
  const messageRecord = firstChoice === undefined ? undefined : asRecord(firstChoice['message']);
  if (messageRecord === undefined) {
    throw new LlmResponseError(provider, 'first choice had no `message` object');
  }

  const text = readString(messageRecord, 'content') ?? '';
  const model = readString(parsed, 'model') ?? req.model;

  const response: LlmCompletionResponse = { text, model };

  const usageRecord = asRecord(parsed['usage']);
  if (usageRecord !== undefined) {
    const usage: LlmUsage = {};
    const promptTokens = readNumber(usageRecord, 'prompt_tokens');
    const completionTokens = readNumber(usageRecord, 'completion_tokens');
    if (promptTokens !== undefined) usage.promptTokens = promptTokens;
    if (completionTokens !== undefined) usage.completionTokens = completionTokens;
    if (usage.promptTokens !== undefined || usage.completionTokens !== undefined) {
      response.usage = usage;
    }
  }

  if (provider === 'perplexity') {
    const citations = extractCitations(parsed['citations']);
    if (citations.length > 0) response.citations = citations;
  }

  return response;
}
