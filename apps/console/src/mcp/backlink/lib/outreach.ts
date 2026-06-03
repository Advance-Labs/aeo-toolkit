/**
 * Outreach-email generation via `@aeo/llm` (BYOK).
 *
 * The handler collects a contact + context object, builds a focused prompt, and
 * routes it through the provider-agnostic `complete()` client. The API key is
 * request-scoped: it arrives in the tool input, is forwarded to `complete()`, and
 * is never logged or persisted. We isolate the LLM call behind `OutreachClient`
 * so tests can inject a fake and assert prompt shaping without a live key.
 */
import type {
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmMessage,
  LlmProvider,
} from '@aeo/types';

export interface OutreachContact {
  name?: string;
  email?: string;
  site?: string;
  role?: string;
}

export interface OutreachContext {
  /** Your brand/site doing the outreach. */
  fromBrand: string;
  /** Your name to sign off with. */
  fromName?: string;
  /** Why you're reaching out — the angle (broken link, resource page, guest post...). */
  reason: string;
  /** The specific URL/page you want linked or mentioned. */
  targetUrl?: string;
  /** Optional extra notes to weave in (recent article, shared interest, etc.). */
  notes?: string;
  /** Desired tone; defaults to a concise, professional voice. */
  tone?: string;
}

export interface OutreachRequest {
  contact: OutreachContact;
  context: OutreachContext;
  provider: LlmProvider;
  model: string;
  /** BYOK — request-scoped, forwarded to `@aeo/llm`, never persisted. */
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
}

/** The single seam onto `@aeo/llm.complete` so handlers stay testable. */
export interface OutreachClient {
  complete: (req: LlmCompletionRequest) => Promise<LlmCompletionResponse>;
}

const SYSTEM_PROMPT =
  'You are an expert outreach copywriter for link-building and digital PR. You write short, ' +
  'personalized, non-spammy cold emails that lead with genuine value and a single clear ask. ' +
  'Never fabricate facts about the recipient. Output only the email: a subject line prefixed ' +
  'with "Subject:" on the first line, then a blank line, then the body. No preamble, no notes.';

/** Build the system+user messages for an outreach request. Pure — easy to test. */
export function buildOutreachMessages(req: OutreachRequest): LlmMessage[] {
  const { contact, context } = req;
  const lines: string[] = [];

  lines.push('Write a cold outreach email with these details:');
  lines.push('');
  lines.push('Recipient:');
  lines.push(`- Name: ${contact.name ?? '(unknown — use a warm but neutral greeting)'}`);
  if (contact.role) lines.push(`- Role: ${contact.role}`);
  if (contact.site) lines.push(`- Their site: ${contact.site}`);
  lines.push('');
  lines.push('Sender:');
  lines.push(`- Brand: ${context.fromBrand}`);
  if (context.fromName) lines.push(`- Name: ${context.fromName}`);
  lines.push('');
  lines.push('Outreach angle / reason:');
  lines.push(`- ${context.reason}`);
  if (context.targetUrl) lines.push(`- Page we'd like linked or featured: ${context.targetUrl}`);
  if (context.notes) lines.push(`- Personalization notes: ${context.notes}`);
  lines.push('');
  lines.push(`Tone: ${context.tone ?? 'concise, friendly, professional'}.`);
  lines.push('Keep the body under 130 words. One clear call to action.');

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: lines.join('\n') },
  ];
}

export interface OutreachResult {
  subject: string;
  body: string;
  /** The full raw model output (subject + body) for clients that want it verbatim. */
  raw: string;
  model: string;
}

/** Split the model output into a subject line and body, tolerant of formatting. */
export function splitEmail(raw: string): { subject: string; body: string } {
  const text = raw.trim();
  const match = text.match(/^subject:\s*(.+)$/im);
  if (match && typeof match[1] === 'string') {
    const subject = match[1].trim();
    const body = text.slice(text.indexOf(match[0]) + match[0].length).trim();
    return { subject, body: body || text };
  }
  // No explicit subject line — treat the first non-empty line as the subject.
  const firstBreak = text.indexOf('\n');
  if (firstBreak > 0) {
    return { subject: text.slice(0, firstBreak).trim(), body: text.slice(firstBreak).trim() };
  }
  return { subject: '(no subject)', body: text };
}

/**
 * Generate an outreach email. Routes the prompt through the injected
 * `OutreachClient` (default: `@aeo/llm.complete`) and parses the result.
 */
export async function generateOutreach(
  client: OutreachClient,
  req: OutreachRequest,
): Promise<OutreachResult> {
  const completionRequest: LlmCompletionRequest = {
    provider: req.provider,
    model: req.model,
    apiKey: req.apiKey,
    messages: buildOutreachMessages(req),
    temperature: req.temperature ?? 0.7,
    maxTokens: req.maxTokens ?? 512,
  };

  const res = await client.complete(completionRequest);
  const { subject, body } = splitEmail(res.text);
  return { subject, body, raw: res.text, model: res.model };
}
