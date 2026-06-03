/** Pure helpers shared across provider adapters. No I/O — trivially unit-testable. */

import type { Citation, LlmMessage, LlmRole, Url } from '@aeo/types';

/**
 * Split a flat `LlmMessage[]` into the OpenAI-style chat array plus a hoisted system prompt.
 *
 * Anthropic's Messages API takes `system` as a top-level field rather than a message, and most
 * OpenAI-compatible providers accept a leading `{ role: 'system' }` message. This helper produces
 * both shapes from one source so each adapter maps cleanly:
 *  - `system`   — all system message contents joined (Anthropic puts this in the top-level field).
 *  - `chat`     — the non-system turns, in order (user/assistant).
 */
export interface BuiltMessages {
  /** Concatenated system prompt, or `undefined` when no system message was supplied. */
  system: string | undefined;
  /** Non-system turns preserved in order. */
  chat: Array<{ role: Exclude<LlmRole, 'system'>; content: string }>;
}

export function buildMessages(messages: readonly LlmMessage[]): BuiltMessages {
  const systemParts: string[] = [];
  const chat: BuiltMessages['chat'] = [];

  for (const message of messages) {
    if (message.role === 'system') {
      systemParts.push(message.content);
    } else {
      chat.push({ role: message.role, content: message.content });
    }
  }

  return {
    system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
    chat,
  };
}

/**
 * Normalize Perplexity's citation payload into `Citation[]`.
 *
 * Perplexity Sonar returns `citations` either as an array of bare URL strings or, in newer
 * responses, as objects with `url`/`title`/`snippet`. Both forms are handled; anything that does
 * not yield a usable URL string is skipped rather than throwing, so a malformed entry never sinks
 * an otherwise-valid completion.
 */
export function extractCitations(raw: unknown): Citation[] {
  if (!Array.isArray(raw)) return [];

  const citations: Citation[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      const url = entry.trim();
      if (url.length > 0) citations.push({ url: url as Url });
      continue;
    }
    if (entry !== null && typeof entry === 'object') {
      const obj = entry as Record<string, unknown>;
      const urlValue = obj['url'];
      if (typeof urlValue === 'string' && urlValue.trim().length > 0) {
        const citation: Citation = { url: urlValue.trim() as Url };
        const title = obj['title'];
        if (typeof title === 'string') citation.title = title;
        const snippet = obj['snippet'] ?? obj['text'];
        if (typeof snippet === 'string') citation.snippet = snippet;
        citations.push(citation);
      }
    }
  }
  return citations;
}
