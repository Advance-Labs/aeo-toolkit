/**
 * Vercel Cron endpoint for the autonomous blogging pipeline.
 *
 * Vercel Cron issues a daily GET to this route (see `vercel.json`) and sends
 * `Authorization: Bearer <CRON_SECRET>`. We require that header to match `process.env.CRON_SECRET`
 * exactly and return 401 otherwise, so the route cannot be triggered by the public internet.
 *
 * On success we run one pass of `runBloggingPipeline` — which resolves every seam (BYOK LLM keys,
 * the Google access token, Supabase, the publish webhook) from the environment — and return the
 * log-safe `RunSummary` as JSON. BYOK keys and credentials are read inside the package, never read
 * or logged here. Errors are surfaced as a 500 with only the error message (never a secret).
 */
import { NextResponse } from 'next/server';
import { runBloggingPipeline } from '@aeo/blogging';

// Network + crawl + LLM work needs the Node runtime, not Edge.
export const runtime = 'nodejs';
// Disable any caching of this route; each cron tick must execute a fresh run.
export const dynamic = 'force-dynamic';
// Give the pipeline plenty of headroom (seconds). Vercel caps this per plan.
export const maxDuration = 300;

/** Constant-time-ish bearer check against `CRON_SECRET`. */
function isAuthorized(request: Request): boolean {
  const secret = process.env['CRON_SECRET'];
  if (secret === undefined || secret.length === 0) return false;
  const header = request.headers.get('authorization');
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const summary = await runBloggingPipeline(process.env);
    return NextResponse.json({ ok: true, summary });
  } catch (err: unknown) {
    // Never log or return credentials — only the error message.
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
