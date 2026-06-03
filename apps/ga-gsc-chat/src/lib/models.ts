/**
 * Default model suggestions per provider for the BYOK picker. These are convenience defaults only;
 * the user can type any model string. Plain data, no side effects.
 */
import type { LlmProvider } from '@aeo/types';

export interface ProviderOption {
  provider: LlmProvider;
  label: string;
  defaultModel: string;
}

export const PROVIDER_OPTIONS: readonly ProviderOption[] = [
  { provider: 'anthropic', label: 'Anthropic (Claude)', defaultModel: 'claude-sonnet-4-20250514' },
  { provider: 'openai', label: 'OpenAI', defaultModel: 'gpt-4o' },
  { provider: 'groq', label: 'Groq', defaultModel: 'llama-3.3-70b-versatile' },
  { provider: 'perplexity', label: 'Perplexity Sonar', defaultModel: 'sonar' },
  { provider: 'gateway', label: 'Vercel AI Gateway', defaultModel: 'anthropic/claude-sonnet-4' },
] as const;

export function defaultModelFor(provider: LlmProvider): string {
  const match = PROVIDER_OPTIONS.find((o) => o.provider === provider);
  return match?.defaultModel ?? '';
}
