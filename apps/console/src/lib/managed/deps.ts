/**
 * Orchestrator dependency wiring for the Managed tier (server-only I/O adapter).
 *
 * In the done-for-you model Advance Labs runs the work, so the LLM models/keys are PLATFORM-level
 * (from env), while the GSC access token is the customer's own (from the hardened token store).
 * `buildDepsForCustomer` assembles a per-customer {@link OrchestratorDeps}; `managedModelsFromEnv`
 * returns null when the platform LLM config is absent (dormant → no content generation).
 */
import {
  SupabaseProposalStore,
  createLiveContentRunner,
  createLiveOutreachRunner,
  type OrchestratorDeps,
  type SupabaseLike,
  type LiveContentRunnerConfig,
} from '@aeo/orchestrator';
import { createLiveHttpClient } from '@aeo/backlinks';
import { createLiveSafeFetchDeps } from '@aeo/net-guard';

type ModelChoice = LiveContentRunnerConfig['draftModel'];

const USER_AGENT = 'AEO-Toolkit-Autopilot/1.0 (+https://aeo.advancelabs.dev)';
const HTTP_TIMEOUT_MS = 15_000;

export interface ManagedModels {
  draftModel: ModelChoice;
  reasoningModel: ModelChoice;
}

/** Platform-provided drafting/reasoning models for the managed service. Null if not configured. */
export function managedModelsFromEnv(): ManagedModels | null {
  const provider = process.env.MANAGED_LLM_PROVIDER;
  const apiKey = process.env.MANAGED_LLM_API_KEY;
  const draft = process.env.MANAGED_DRAFT_MODEL;
  const reasoning = process.env.MANAGED_REASONING_MODEL;
  if (!provider || !apiKey || !draft || !reasoning) return null;
  const p = provider as ModelChoice['provider'];
  return {
    draftModel: { provider: p, model: draft, apiKey },
    reasoningModel: { provider: p, model: reasoning, apiKey },
  };
}

export interface CustomerRunConfig {
  client: SupabaseLike;
  /** The customer's Google OAuth access token (GSC), from the hardened token store. May be empty. */
  googleAccessToken: string;
  models: ManagedModels;
}

/** Build the per-customer {@link OrchestratorDeps} for one cadence pass. */
export function buildDepsForCustomer(cfg: CustomerRunConfig): OrchestratorDeps {
  return {
    store: new SupabaseProposalStore({ client: cfg.client }),
    clock: () => new Date(),
    content: createLiveContentRunner({
      googleAccessToken: cfg.googleAccessToken,
      draftModel: cfg.models.draftModel,
      reasoningModel: cfg.models.reasoningModel,
    }),
    outreach: createLiveOutreachRunner({
      http: createLiveHttpClient({ userAgent: USER_AGENT, requestTimeoutMs: HTTP_TIMEOUT_MS }),
      fetchDeps: createLiveSafeFetchDeps(),
    }),
  };
}
