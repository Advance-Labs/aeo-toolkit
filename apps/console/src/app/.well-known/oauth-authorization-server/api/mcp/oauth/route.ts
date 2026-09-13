/**
 * RFC 8414 metadata for the search server's authorization server, whose issuer is
 * `${origin}/api/mcp/oauth`. RFC 8414 §3.1 inserts the well-known segment BEFORE the issuer's path,
 * hence this location. The root document next door stays 404; see `@/mcp/oauth/config`.
 */
import { authorizationServerMetadata } from '@/mcp/oauth/metadata.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(request: Request): Response {
  return authorizationServerMetadata(request);
}
