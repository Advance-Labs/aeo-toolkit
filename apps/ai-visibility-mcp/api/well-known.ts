/**
 * Vercel Function entries for OAuth 2.1 `.well-known` discovery.
 *
 * Claude.ai fetches these to auto-register against the hosted MCP server. The
 * documents are pure JSON built from env (`MCP_PUBLIC_URL`, `OAUTH_ISSUER`,
 * `OAUTH_AUTHORIZATION_SERVERS`) via the shared builders in `src/http.ts`.
 *
 * Map these in `vercel.json`:
 *   /.well-known/oauth-authorization-server  → api/well-known.ts?doc=as
 *   /.well-known/oauth-protected-resource    → api/well-known.ts?doc=pr
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

import { oauthAuthorizationServerMetadata, oauthProtectedResourceMetadata } from '../src/http.js';

type VercelRequest = IncomingMessage & { query?: Record<string, string | string[] | undefined> };

export default function handler(req: VercelRequest, res: ServerResponse): void {
  const docParam = req.query?.doc;
  const doc = Array.isArray(docParam) ? docParam[0] : docParam;

  const body =
    doc === 'as'
      ? oauthAuthorizationServerMetadata()
      : doc === 'pr'
        ? oauthProtectedResourceMetadata()
        : { error: 'unknown_discovery_document', hint: 'use ?doc=as or ?doc=pr' };

  const status = 'error' in body ? 400 : 200;
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload).toString(),
  });
  res.end(payload);
}

export const config = { runtime: 'nodejs' } as const;
