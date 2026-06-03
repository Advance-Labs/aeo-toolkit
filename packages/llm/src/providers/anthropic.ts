/**
 * Anthropic Messages API adapter — POST https://api.anthropic.com/v1/messages
 *
 * Auth: `x-api-key` header (BYOK) + the required `anthropic-version` header. The system prompt is
 * hoisted to the top-level `system` field; user/assistant turns map to `messages`. The assistant
 * reply is reassembled by joining every `content[].text` block of type `text`.
 */

import type { LlmCompletionRequest, LlmCompletionResponse, LlmUsage } from '@aeo/types';
import type { Fetcher } from '../fetcher.js';
import { buildMessages } from '../helpers.js';
import { LlmHttpError, LlmResponseError } from '../errors.js';
import { asRecord, parseJson, readNumber, readString } from '../json.js';

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

/** Anthropic requires an explicit max_tokens; this is used when the request omits one. */
const DEFAULT_MAX_TOKENS = 1024;

export async function completeAnthropic(
  req: LlmCompletionRequest,
  fetcher: Fetcher,
): Promise<LlmCompletionResponse> {
  const { system, chat } = buildMessages(req.messages);

  const body: Record<string, unknown> = {
    model: req.model,
    max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
    messages: chat,
  };
  if (system !== undefined) body['system'] = system;
  if (req.temperature !== undefined) body['temperature'] = req.temperature;

  const res = await fetcher(ANTHROPIC_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': req.apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new LlmHttpError('anthropic', res.status, res.statusText, raw);
  }

  const parsed = asRecord(parseJson('anthropic', raw));
  if (parsed === undefined) {
    throw new LlmResponseError('anthropic', 'top-level response was not an object');
  }

  const content = parsed['content'];
  if (!Array.isArray(content)) {
    throw new LlmResponseError('anthropic', 'missing `content` array');
  }

  const text = content
    .map((block) => {
      const record = asRecord(block);
      if (record === undefined) return '';
      return record['type'] === 'text' ? (readString(record, 'text') ?? '') : '';
    })
    .join('');

  const model = readString(parsed, 'model') ?? req.model;

  const response: LlmCompletionResponse = { text, model };

  const usageRecord = asRecord(parsed['usage']);
  if (usageRecord !== undefined) {
    const usage: LlmUsage = {};
    const promptTokens = readNumber(usageRecord, 'input_tokens');
    const completionTokens = readNumber(usageRecord, 'output_tokens');
    if (promptTokens !== undefined) usage.promptTokens = promptTokens;
    if (completionTokens !== undefined) usage.completionTokens = completionTokens;
    if (usage.promptTokens !== undefined || usage.completionTokens !== undefined) {
      response.usage = usage;
    }
  }

  return response;
}
