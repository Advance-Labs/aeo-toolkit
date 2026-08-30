/**
 * @advance-labs/mcp-core — shared kit for the three AEO MCP servers.
 *
 * Built on `@modelcontextprotocol/sdk`. Re-exports only the surface consumers
 * (ai-visibility-mcp, ga-gsc-mcp, backlink-mcp) need: server + tool registry
 * helpers, token-bucket rate limiting, OAuth 2.1 `.well-known` discovery
 * builders, transport mounters, and the structured tool-error helper.
 */

export { createServer, registerTool } from './server.js';
export type {
  CreatedServer,
  McpToolDef,
  ShapeInput,
  ToolResult,
  ToolSuccessResult,
  ToolTextContent,
} from './server.js';

export { RateLimiter } from './rate-limit.js';
export type { Clock } from './rate-limit.js';

export { wellKnownOAuthMetadata, wellKnownProtectedResource } from './oauth.js';
export type {
  OAuthMetadataConfig,
  OAuthAuthorizationServerMetadata,
  ProtectedResourceConfig,
  OAuthProtectedResourceMetadata,
} from './oauth.js';

export { mountStdio, mountHttp, mountSse } from './transport.js';
export type { HttpTransportOptions } from './transport.js';

export {
  enforceWebRateLimit,
  callerKeyFromHeaders,
  rateLimitedBody,
  rateLimitedResponse,
  ANONYMOUS_CALLER_KEY,
} from './web-rate-limit.js';
export type { WebRateLimiter, WebRateLimitResult, RateLimitedBody } from './web-rate-limit.js';

export { toToolError, errorMessage, McpToolError } from './errors.js';
export type { ToolErrorResult } from './errors.js';

/** Package version marker surfaced in server metadata / diagnostics. */
export const MCP_CORE_VERSION = '0.1.0';
