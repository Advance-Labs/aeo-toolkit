/**
 * RFC 9728 metadata for the search MCP server (`/api/mcp/search/mcp`). The server's 401 challenge
 * names this URL in `resource_metadata`; it tells the client which authorization server to log in at.
 */
import { protectedResourceMetadata } from '@/mcp/oauth/metadata.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(request: Request): Response {
  return protectedResourceMetadata(request, '/api/mcp/search/mcp');
}
