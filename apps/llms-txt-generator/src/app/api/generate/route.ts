/**
 * POST /api/generate — crawl a site and generate its llms.txt manifest.
 *
 * Body: { url: string, full?: boolean }
 * Runs on the Node runtime (the crawler uses Node `fetch` + needs no edge limits).
 */
import { NextResponse } from 'next/server';
import { CrawlerError } from '@aeo/crawler';
import { generateLlmsTxt } from '@/lib/generate';
import type { GenerateErrorResponse, GenerateRequest, GenerateResponse } from '@/lib/types';

// Crawling is server-side, network-bound work — force the Node runtime, no edge.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Prepend `https://` when the caller omits a scheme; throws on invalid input. */
function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  // Throws (TypeError) when structurally invalid — caught by the handler.
  return new URL(withScheme).toString();
}

function isGenerateRequest(value: unknown): value is GenerateRequest {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.url !== 'string') return false;
  if ('full' in candidate && typeof candidate.full !== 'boolean') return false;
  return true;
}

export async function POST(
  request: Request,
): Promise<NextResponse<GenerateResponse | GenerateErrorResponse>> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  if (!isGenerateRequest(payload)) {
    return NextResponse.json(
      { error: 'Body must be { url: string, full?: boolean }.' },
      { status: 400 },
    );
  }

  let normalized: string;
  try {
    normalized = normalizeUrl(payload.url);
  } catch {
    return NextResponse.json({ error: 'That does not look like a valid URL.' }, { status: 400 });
  }

  try {
    const result = await generateLlmsTxt(normalized, { full: payload.full === true });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof CrawlerError
        ? `Crawl failed: ${error.message}`
        : error instanceof Error
          ? error.message
          : 'Unexpected error while generating llms.txt.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
