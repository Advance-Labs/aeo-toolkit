/**
 * Client-side transport DTOs for the GA4 + Search Console chat tool. These mirror
 * the wire contract of the API routes the web-APIs agent exposes; they are kept here
 * (in the component tree) so the chat UI never imports from `src/app/api/**`.
 *
 *   - `POST /api/chat`        body {@link ChatRequestBody} → {@link ChatResponseBody} | {@link ChatErrorBody}.
 *   - `GET  /api/connection`                              → {@link ConnectionResponse}.
 */
import type { Ga4Property, GscSite, LlmProvider } from '@aeo/types';

export interface ChatRequestBody {
  question: string;
  propertyId: string;
  siteUrl: string;
  llmProvider: LlmProvider;
  model: string;
  /** BYOK — request-scoped only; never persisted or logged server-side. */
  apiKey: string;
}

export interface ChatResponseBody {
  answer: string;
  model: string;
  /** The compact GA4 + GSC context the answer was grounded in (returned for transparency). */
  dataContext: string;
}

export interface ChatErrorBody {
  error: string;
}

/** Shape of `GET /api/connection` — whether Google is connected, plus picker options. */
export interface ConnectionResponse {
  connected: boolean;
  sites: GscSite[];
  properties: Ga4Property[];
}
