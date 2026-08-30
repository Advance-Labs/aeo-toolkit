/** LLM domain — provider-agnostic BYOK client shapes for `@advance-labs/llm`. */
import type { Url } from './crawl.js';

export type LlmProvider = 'anthropic' | 'openai' | 'groq' | 'perplexity' | 'gateway';

export type LlmRole = 'system' | 'user' | 'assistant';

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

export interface Citation {
  url: Url;
  title?: string;
  snippet?: string;
}

export interface LlmCompletionRequest {
  provider: LlmProvider;
  model: string;
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  /** BYOK — request-scoped, never persisted or logged. */
  apiKey: string;
}

export interface LlmUsage {
  promptTokens?: number;
  completionTokens?: number;
}

export interface LlmCompletionResponse {
  text: string;
  model: string;
  usage?: LlmUsage;
  /** Perplexity Sonar returns source citations used for AI-visibility checks. */
  citations?: Citation[];
}
