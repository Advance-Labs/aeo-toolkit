/**
 * Transport mounting helpers — thin wrappers over the SDK transports so the MCP
 * servers can pick stdio (Claude Desktop) or HTTP (Streamable HTTP / legacy SSE,
 * for Claude.ai remote connectors) without restating boilerplate.
 *
 * These are deliberately minimal: they construct the SDK transport and call
 * `server.connect(transport)`. They contain no testable branching of their own —
 * the unit tests cover the pure logic (rate limit, OAuth, errors). The transport
 * constructors are wrapped so a minor SDK change is localised here.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

import type { CreatedServer } from './server.js';

/** Accept either our `CreatedServer` wrapper or a bare `McpServer`. */
function resolveServer(target: CreatedServer | McpServer): McpServer {
  return target instanceof McpServer ? target : target.server;
}

/**
 * Mount the server on a stdio transport (local process integration, e.g.
 * Claude Desktop). Resolves once the transport is connected.
 */
export async function mountStdio(target: CreatedServer | McpServer): Promise<StdioServerTransport> {
  const server = resolveServer(target);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return transport;
}

export interface HttpTransportOptions {
  /**
   * Session id generator. Pass `undefined` for stateless per-request mode
   * (recommended for serverless / Vercel Functions). Provide a generator (e.g.
   * `() => randomUUID()`) for stateful sessions.
   */
  sessionIdGenerator?: () => string;
  /** Enable JSON response mode instead of SSE streaming where supported. */
  enableJsonResponse?: boolean;
}

/**
 * Mount the server on a Streamable HTTP transport (the modern remote transport
 * used by Claude.ai connectors). Returns the transport so the caller can pump
 * requests via `transport.handleRequest(req, res, body)`.
 *
 * Defaults to stateless per-request mode (`sessionIdGenerator: undefined`),
 * which is the right choice for serverless deployments.
 */
export async function mountHttp(
  target: CreatedServer | McpServer,
  opts: HttpTransportOptions = {},
): Promise<StreamableHTTPServerTransport> {
  const server = resolveServer(target);
  // STUB: the SDK transport options type is restated minimally here; the SDK
  // accepts `sessionIdGenerator` (undefined => stateless) and
  // `enableJsonResponse`. Widened to keep us compiling across 1.x minors.
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: opts.sessionIdGenerator,
    enableJsonResponse: opts.enableJsonResponse,
  });
  await server.connect(transport);
  return transport;
}

/**
 * Mount the server on the legacy HTTP+SSE transport. Some existing Claude.ai
 * connectors still negotiate this older transport; new deployments should
 * prefer {@link mountHttp}.
 *
 * @param messagePath  the POST path clients send JSON-RPC messages to (e.g. `/messages`)
 * @param res          the Node/SSE-capable response object the SDK writes the stream to
 */
export async function mountSse(
  target: CreatedServer | McpServer,
  messagePath: string,
  res: ConstructorParameters<typeof SSEServerTransport>[1],
): Promise<SSEServerTransport> {
  const server = resolveServer(target);
  const transport = new SSEServerTransport(messagePath, res);
  await server.connect(transport);
  return transport;
}
