/**
 * Vercel Function entry for the hosted GA4 + GSC MCP server.
 *
 * Vercel's Node runtime invokes the default export with Node-compatible
 * `IncomingMessage` / `ServerResponse` objects. We build the shared runtime once per
 * cold start (so the in-memory fallback store survives within a warm instance, and the
 * Supabase client is constructed a single time) and delegate every request to the
 * shared {@link handleHttp} router in `src/http.ts`, which dispatches `/mcp`, the
 * `.well-known` OAuth discovery docs, the OAuth `authorize` redirect, and the OAuth
 * callback.
 *
 * `vercel.json` rewrites all of these paths to this single function so the router in
 * `handleHttp` (keyed on method + pathname) stays the single source of truth.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

import { buildRuntime, handleHttp, type HttpRuntime } from '../src/http.js';

/** Vercel may pre-parse the JSON body; the router re-reads the stream only if needed. */
type VercelRequest = IncomingMessage & { body?: unknown };

// Built once per cold start and reused across warm invocations.
let runtime: HttpRuntime | undefined;

function getRuntime(): HttpRuntime {
  runtime ??= buildRuntime();
  return runtime;
}

export default async function handler(req: VercelRequest, res: ServerResponse): Promise<void> {
  await handleHttp(getRuntime(), req, res);
}

/** Node.js runtime (not Edge) — the MCP transport + Google fetch need Node streams. */
export const config = { runtime: 'nodejs' } as const;
