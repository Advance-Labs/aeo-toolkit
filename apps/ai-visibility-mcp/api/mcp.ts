/**
 * Vercel Function entry for the hosted MCP endpoint.
 *
 * Vercel's Node runtime invokes the default export with Node-compatible
 * `IncomingMessage` / `ServerResponse` objects. We delegate to the shared
 * `handleMcpRequest`, which builds a stateless Streamable-HTTP transport per
 * request — the right shape for serverless. Vercel may pre-parse the JSON body
 * onto `req.body`; we pass it through to avoid re-reading the stream.
 *
 * Route this at `/mcp` via `vercel.json` rewrites or the file-system router.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

import { handleMcpRequest } from '../src/http.js';

/** Vercel augments the Node request with an optional parsed `body`. */
type VercelRequest = IncomingMessage & { body?: unknown };

export default async function handler(req: VercelRequest, res: ServerResponse): Promise<void> {
  await handleMcpRequest(req, res, req.body);
}

/** Use the Node.js runtime (not Edge) — the crawler + LLM client need Node fetch + streams. */
export const config = { runtime: 'nodejs' } as const;
