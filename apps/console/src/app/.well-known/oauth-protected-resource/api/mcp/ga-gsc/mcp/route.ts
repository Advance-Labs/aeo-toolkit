/**
 * RFC 9728 metadata for the `ga-gsc` compatibility alias of the search MCP server, so a client
 * config pinned to the old path can log in the same way.
 */
import { protectedResourceMetadata } from '@/mcp/oauth/metadata.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(request: Request): Response {
  return protectedResourceMetadata(request, '/api/mcp/ga-gsc/mcp');
}
