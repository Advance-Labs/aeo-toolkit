/**
 * Runtime configuration resolution.
 *
 * Reads BYOK keys and Google credentials from the environment at run time. Keys are request-scoped:
 * they live only in the returned `AgentConfig`, are never persisted, and must never be logged. The
 * cost-split is encoded here — bulk drafting routes to Groq, strategic reasoning to a stronger
 * model (Anthropic or OpenAI, whichever key is present).
 */
import type { AgentConfig, ModelChoice } from './types.js';

/** A read-only view of process env, injectable for tests. */
export type Env = Readonly<Record<string, string | undefined>>;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

function required(env: Env, key: string): string {
  const value = env[key];
  if (value === undefined || value.trim().length === 0) {
    throw new ConfigError(`Missing required environment variable: ${key}`);
  }
  return value;
}

function numberOr(env: Env, key: string, fallback: number): number {
  const raw = env[key];
  if (raw === undefined || raw.trim().length === 0) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new ConfigError(`Environment variable ${key} must be a number.`);
  return n;
}

/** Resolve the bulk-drafting model (Groq). */
export function resolveDraftModel(env: Env): ModelChoice {
  return {
    provider: 'groq',
    model: env['GROQ_MODEL'] ?? 'llama-3.3-70b-versatile',
    apiKey: required(env, 'GROQ_API_KEY'),
  };
}

/**
 * Resolve the strategic-reasoning model. Prefers Anthropic, falls back to OpenAI; throws if neither
 * key is present.
 */
export function resolveReasoningModel(env: Env): ModelChoice {
  const anthropic = env['ANTHROPIC_API_KEY'];
  if (anthropic && anthropic.trim().length > 0) {
    return {
      provider: 'anthropic',
      model: env['ANTHROPIC_MODEL'] ?? 'claude-sonnet-4-20250514',
      apiKey: anthropic,
    };
  }
  const openai = env['OPENAI_API_KEY'];
  if (openai && openai.trim().length > 0) {
    return { provider: 'openai', model: env['OPENAI_MODEL'] ?? 'gpt-4o', apiKey: openai };
  }
  throw new ConfigError('No reasoning model key found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.');
}

/** Build the full runtime config from the environment. */
export function loadConfig(env: Env): AgentConfig {
  const siteUrl = required(env, 'SITE_URL');
  return {
    siteUrl,
    gscSiteUrl: env['GSC_SITE_URL'] ?? siteUrl,
    ga4PropertyId: required(env, 'GA4_PROPERTY_ID'),
    draftModel: resolveDraftModel(env),
    reasoningModel: resolveReasoningModel(env),
    googleAccessToken: required(env, 'GOOGLE_ACCESS_TOKEN'),
    maxNewPostsPerRun: numberOr(env, 'MAX_NEW_POSTS_PER_RUN', 3),
    underperformanceThreshold: numberOr(env, 'UNDERPERFORMANCE_THRESHOLD', 0.3),
    dedupThreshold: numberOr(env, 'DEDUP_THRESHOLD', 0.8),
  };
}
