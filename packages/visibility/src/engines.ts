import { gateway, generateText, stepCountIs, type LanguageModel } from 'ai';

/**
 * Gateway slugs measured on the visibility wall (2026-10-30), each carrying the `web-search`
 * capability. gpt-5.6-sol cost $0.25-0.33 per answer with search; luna is ~$0.007.
 *
 * Caveat: Perplexity searches natively; the others are handed the gateway's Perplexity search
 * tool. This measures "would this model name the brand when reasoning over live search
 * results", not a replay of chatgpt.com. Never describe it as the latter.
 */
export const DEFAULT_ENGINES: readonly string[] = [
  'perplexity/sonar',
  'openai/gpt-5.6-luna',
  'google/gemini-3.7-flash',
];

/** Results per search call; 10 roughly doubled input tokens for no better answers. */
export const SEARCH_RESULTS = 5;

const SYSTEM =
  'You are a shopping-research assistant. Search the web, then recommend specific real ' +
  'companies by name. Name several so the answer is genuinely comparative. Run one web ' +
  'search, then answer from those results.';

/** "openai/gpt-5.6-luna" -> "openai". */
export function engineLabel(slug: string): string {
  return slug.split('/')[0]!;
}

export interface AskOptions {
  /** Override the model object (tests, custom providers). The slug is then only a label. */
  model?: LanguageModel;
  timeoutMs?: number;
  /** Extra gateway spend tags. */
  tags?: string[];
  /** Force or skip the search tool. Default: attach unless the slug starts with perplexity/. */
  searchTool?: boolean;
}

export interface EngineAnswer {
  text: string;
  sources: string[];
  engine: string;
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  /** Gateway-reported cost in USD when the result exposes it (providerMetadata.gateway.cost). */
  costUsd?: number;
}

type Row = { url?: unknown; link?: unknown };
type Loose = { results?: unknown[]; sources?: unknown[] } | unknown[] | undefined;

interface ResultLike {
  sources?: { url?: string }[];
  steps?: { toolResults?: { output?: unknown; result?: unknown }[] }[];
}

/** Citation URLs from both shapes: native `sources` and search-tool outputs. Deduped. */
export function collectSources(result: ResultLike): string[] {
  const urls = new Set<string>();
  const add = (u: unknown) => {
    if (typeof u === 'string' && /^https?:\/\//i.test(u)) urls.add(u);
  };
  for (const s of result.sources ?? []) add(s?.url);
  for (const step of result.steps ?? []) {
    for (const tr of step.toolResults ?? []) {
      const out = (tr?.output ?? tr?.result) as Loose;
      const rows = Array.isArray(out) ? out : (out?.results ?? out?.sources ?? []);
      for (const r of Array.isArray(rows) ? rows : []) add((r as Row)?.url ?? (r as Row)?.link);
    }
  }
  return [...urls];
}

/**
 * Gateway-reported cost summed across ALL steps. Tool-backed engines take 2-3 steps (search, then answer);
 * the top-level providerMetadata only describes the last one. Undefined when no step reported a cost.
 */
export function totalCost(result: { steps?: { providerMetadata?: unknown }[]; providerMetadata?: unknown }): number | undefined {
  const steps = result.steps?.length ? result.steps : [{ providerMetadata: result.providerMetadata }];
  let sum: number | undefined;
  for (const st of steps) {
    const c = gatewayCost(st.providerMetadata);
    if (c !== undefined) sum = (sum ?? 0) + c;
  }
  return sum;
}

function gatewayCost(meta: unknown): number | undefined {
  const raw = (meta as { gateway?: { cost?: unknown } } | undefined)?.gateway?.cost;
  const n = typeof raw === 'string' ? Number(raw) : raw;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}

/**
 * Ask one engine one buyer question. Auth comes from the environment (AI_GATEWAY_API_KEY or
 * VERCEL_OIDC_TOKEN), handled by the AI SDK.
 */
export async function askEngine(
  slug: string,
  prompt: string,
  opts: AskOptions = {},
): Promise<EngineAnswer> {
  const useTool = opts.searchTool ?? !slug.startsWith('perplexity/');
  const result = await generateText({
    model: opts.model ?? gateway(slug),
    system: SYSTEM,
    prompt,
    ...(useTool
      ? {
          tools: { web_search: gateway.tools.perplexitySearch({ maxResults: SEARCH_RESULTS }) },
          // step 1 calls the tool, step 2 writes the answer over the results
          stopWhen: stepCountIs(3),
        }
      : {}),
    ...(opts.timeoutMs ? { abortSignal: AbortSignal.timeout(opts.timeoutMs) } : {}),
    providerOptions: { gateway: { tags: ['feature:visibility', ...(opts.tags ?? [])] } },
  });

  // totalUsage = sum over every step (usage alone is only the final step).
  const u = result.totalUsage ?? result.usage;
  return {
    text: result.text || '',
    sources: collectSources(result as ResultLike),
    engine: engineLabel(slug),
    model: slug,
    usage: u
      ? { inputTokens: u.inputTokens, outputTokens: u.outputTokens, totalTokens: u.totalTokens }
      : undefined,
    costUsd: totalCost(result),
  };
}
