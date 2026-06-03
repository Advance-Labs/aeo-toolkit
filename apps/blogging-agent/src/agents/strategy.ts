/**
 * Strategy agent — one-time competitor / content-pillar research.
 *
 * Uses the stronger reasoning model (via `@aeo/llm`) to turn a seed description of the site into
 * a structured `Strategy` (pillars, competitors, audience, voice). Pure-ish: the only effect is
 * the injected `complete` call, which tests mock.
 */
import type { LlmCompletionRequest } from '@aeo/types';
import type { CompleteFn } from '../llm/client.js';
import type { ModelChoice, Strategy } from '../types.js';

export interface StrategyInput {
  siteUrl: string;
  /** Free-text description of the business / blog focus. */
  seedDescription: string;
  /** Known competitor root domains (optional; the model may add more). */
  knownCompetitors?: string[];
  model: ModelChoice;
}

const SYSTEM_PROMPT =
  'You are a content strategist. Given a website and its focus, produce a JSON content strategy. ' +
  'Respond with ONLY a JSON object matching: ' +
  '{"pillars":string[],"competitors":string[],"audience":string,"voice":string}. ' +
  'Pillars are 3-6 broad evergreen themes. Competitors are root domains. No prose, no markdown fences.';

interface StrategyDraft {
  pillars: string[];
  competitors: string[];
  audience: string;
  voice: string;
}

/** Strip optional ```json fences and parse, narrowing unknown JSON to the expected shape. */
export function parseStrategyJson(raw: string): StrategyDraft {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  const parsed: unknown = JSON.parse(cleaned);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new StrategyParseError('strategy response was not a JSON object');
  }
  const obj = parsed as Record<string, unknown>;
  const pillars = asStringArray(obj['pillars']);
  const competitors = asStringArray(obj['competitors']);
  const audience = typeof obj['audience'] === 'string' ? obj['audience'] : '';
  const voice = typeof obj['voice'] === 'string' ? obj['voice'] : '';
  if (pillars.length === 0) {
    throw new StrategyParseError('strategy response had no pillars');
  }
  return { pillars, competitors, audience, voice };
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
}

export class StrategyParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StrategyParseError';
  }
}

/**
 * Run the strategy agent. `now` is injected for deterministic timestamps in tests.
 */
export async function runStrategy(
  input: StrategyInput,
  complete: CompleteFn,
  now: () => Date = () => new Date(),
): Promise<Strategy> {
  const userContent = [
    `Site: ${input.siteUrl}`,
    `Focus: ${input.seedDescription}`,
    input.knownCompetitors && input.knownCompetitors.length > 0
      ? `Known competitors: ${input.knownCompetitors.join(', ')}`
      : 'Known competitors: (none provided — infer plausible ones)',
  ].join('\n');

  const req: LlmCompletionRequest = {
    provider: input.model.provider,
    model: input.model.model,
    apiKey: input.model.apiKey,
    temperature: 0.3,
    maxTokens: 800,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
  };

  const res = await complete(req);
  const draft = parseStrategyJson(res.text);

  // Merge any caller-provided competitors with model output, de-duplicated.
  const competitors = [...new Set([...(input.knownCompetitors ?? []), ...draft.competitors])];

  return {
    siteUrl: input.siteUrl,
    pillars: draft.pillars,
    competitors,
    audience: draft.audience,
    voice: draft.voice,
    generatedAt: now().toISOString(),
  };
}
