/**
 * POST /api/chat — answer a natural-language SEO question grounded in the user's GA4 + GSC data.
 *
 * Flow: validate body → resolve a fresh Google access token for the session → fetch GA4 + GSC →
 * build a compact data context → call the user's own LLM (BYOK) via `@aeo/llm`. The BYOK key is
 * read from the request body, used once, and never persisted or logged. Node runtime only.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { GoogleApiError } from '@aeo/google-api';
import { LlmHttpError, LlmRequestError } from '@aeo/llm';
import { answerQuestion, liveDeps } from '@/lib/answer';
import { parseChatRequest, type ChatResponseBody, type ChatErrorBody } from '@/lib/chat-types';
import { getValidAccessToken, USER_COOKIE } from '@/lib/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function err(message: string, status: number): NextResponse<ChatErrorBody> {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(
  req: NextRequest,
): Promise<NextResponse<ChatResponseBody | ChatErrorBody>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return err('Invalid JSON body.', 400);
  }

  const parsed = parseChatRequest(raw);
  if ('error' in parsed) {
    return err(parsed.error, 400);
  }

  const cookieStore = await cookies();
  const userId = cookieStore.get(USER_COOKIE)?.value;
  if (!userId) {
    return err('Not connected to Google. Connect first.', 401);
  }

  let accessToken: string | null;
  try {
    accessToken = await getValidAccessToken(userId);
  } catch {
    return err('Failed to refresh Google access token. Reconnect Google.', 401);
  }
  if (accessToken === null) {
    return err('Google session expired or missing. Reconnect Google.', 401);
  }

  try {
    const result = await answerQuestion(parsed, liveDeps(accessToken));
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof GoogleApiError) {
      // GA4/GSC upstream error — surface a sanitized message (no token leakage).
      return err(
        `Google API error (status ${e.status}). Check the property/site and try again.`,
        502,
      );
    }
    if (e instanceof LlmRequestError) {
      return err(`LLM request error: ${e.message}`, 400);
    }
    if (e instanceof LlmHttpError) {
      return err(`LLM provider error (status ${e.status}). Check your API key and model.`, 502);
    }
    return err('Unexpected error while answering. Try again.', 500);
  }
}
