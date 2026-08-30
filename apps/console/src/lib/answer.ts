/**
 * Core chat orchestration: fetch GA4 + GSC, compress to a grounding context, and ask the user's own
 * LLM (BYOK) for a grounded answer.
 *
 * All external collaborators (GA4 client, GSC client, LLM `complete`) are injected so the pipeline
 * is unit-testable without live network or credentials. The route handler supplies the real ones.
 */
import { Ga4Client, GscClient } from '@advance-labs/google-api';
import { complete } from '@advance-labs/llm';
import type {
  Ga4Report,
  Ga4ReportRequest,
  GscDimension,
  GscQueryRequest,
  GscReport,
  LlmCompletionRequest,
  LlmCompletionResponse,
} from '@advance-labs/types';
import type { ChatRequestBody, ChatResponseBody } from './chat-types.js';
import { buildDataContext } from './data-context.js';
import { trailingWindow, type DateWindow } from './dates.js';
import { buildMessages } from './prompt.js';

/** GSC dimensions surfaced to the model — query + page is the highest-signal CTR-gap pairing. */
const GSC_DIMENSIONS: readonly GscDimension[] = ['query', 'page'];

/** GA4 dimensions/metrics: engagement + traffic by landing page. */
const GA4_DIMENSIONS = ['pagePath', 'deviceCategory', 'country'];
const GA4_METRICS = ['screenPageViews', 'totalUsers', 'engagementRate', 'averageSessionDuration'];

const ROW_LIMIT = 50;

/** The seam the orchestrator needs: fetch both reports + run an LLM completion. */
export interface AnswerDeps {
  fetchGa4(req: Ga4ReportRequest): Promise<Ga4Report>;
  fetchGsc(req: GscQueryRequest): Promise<GscReport>;
  complete(req: LlmCompletionRequest): Promise<LlmCompletionResponse>;
}

/**
 * Build the real {@link AnswerDeps} from an access token. GA4 + GSC use the read-only token; the LLM
 * call uses the request-scoped BYOK key passed in the completion request, so no key is closed over
 * here.
 */
export function liveDeps(accessToken: string): AnswerDeps {
  const ga4 = new Ga4Client({ accessToken });
  const gsc = new GscClient({ accessToken });
  return {
    fetchGa4: (req) => ga4.runReport(req),
    fetchGsc: (req) => gsc.query(req),
    complete: (req) => complete(req),
  };
}

export interface AnswerOptions {
  window?: DateWindow;
}

/**
 * Run the full grounded-answer pipeline. Returns the answer plus the data context it was grounded
 * in (for UI transparency). Throws on upstream GA4/GSC/LLM errors — the caller maps to HTTP status.
 */
export async function answerQuestion(
  body: ChatRequestBody,
  deps: AnswerDeps,
  opts: AnswerOptions = {},
): Promise<ChatResponseBody> {
  const window = opts.window ?? trailingWindow(28);

  const ga4Request: Ga4ReportRequest = {
    propertyId: body.propertyId,
    dateRanges: [{ startDate: window.startDate, endDate: window.endDate }],
    dimensions: GA4_DIMENSIONS,
    metrics: GA4_METRICS,
    limit: ROW_LIMIT,
  };

  const gscRequest: GscQueryRequest = {
    siteUrl: body.siteUrl,
    startDate: window.startDate,
    endDate: window.endDate,
    dimensions: [...GSC_DIMENSIONS],
    rowLimit: ROW_LIMIT,
  };

  // Fetch both in parallel; a failure in one should not silently drop the other, but we let a
  // genuine error propagate so the user sees an actionable message rather than a half answer.
  const [ga4, gsc] = await Promise.all([deps.fetchGa4(ga4Request), deps.fetchGsc(gscRequest)]);

  const dataContext = buildDataContext({
    propertyId: body.propertyId,
    siteUrl: body.siteUrl,
    startDate: window.startDate,
    endDate: window.endDate,
    ga4,
    gsc,
    gscDimensions: GSC_DIMENSIONS,
  });

  const completion = await deps.complete({
    provider: body.llmProvider,
    model: body.model,
    apiKey: body.apiKey,
    messages: buildMessages({ dataContext, question: body.question }),
    temperature: 0.2,
    maxTokens: 1024,
  });

  return { answer: completion.text, model: completion.model, dataContext };
}
